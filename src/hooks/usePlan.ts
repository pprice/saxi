import { useEffect, useRef, useState } from "react";
import { Device, Plan, PlanOptions } from "../planning";
import { Vec2 } from "../vec";
import PlanWorker from "../plan.worker";

export const usePlan = (paths: Vec2[][] | null, planOptions: PlanOptions) => {
  const [isPlanning, setIsPlanning] = useState(false);
  const [latestPlan, setPlan] = useState(null);

  function serialize(po: PlanOptions): string {
    return JSON.stringify(po, (k, v) => v instanceof Set ? [...v] : v);
  }

  function attemptRejigger(previousOptions: PlanOptions, newOptions: PlanOptions, previousPlan: Plan) {
    const newOptionsWithOldPenHeights = {
      ...newOptions,
      penUpHeight: previousOptions.penUpHeight,
      penDownHeight: previousOptions.penDownHeight,
    };
    if (serialize(previousOptions) === serialize(newOptionsWithOldPenHeights)) {
      // The existing plan should be the same except for penup/pendown heights.
      return previousPlan.withPenHeights(
        Device.Axidraw.penPctToPos(newOptions.penUpHeight),
        Device.Axidraw.penPctToPos(newOptions.penDownHeight)
      );
    }
  }

  const lastPaths = useRef(null);
  const lastPlan = useRef(null);
  const lastPlanOptions = useRef(null);

  useEffect(() => {
    if (!paths) {
      return;
    }
    if (lastPlan.current != null && lastPaths.current === paths) {
      const rejiggered = attemptRejigger(lastPlanOptions.current, planOptions, lastPlan.current);
      if (rejiggered) {
        setPlan(rejiggered);
        lastPlan.current = rejiggered;
        lastPlanOptions.current = planOptions;
        return;
      }
    }
    lastPaths.current = paths;
    const worker = new (PlanWorker as any)();
    setIsPlanning(true);
    console.time("posting to worker");
    worker.postMessage({paths, planOptions});
    console.timeEnd("posting to worker");
    const listener = (m: any) => {
      console.time("deserializing");
      const deserialized = Plan.deserialize(m.data);
      console.timeEnd("deserializing");
      setPlan(deserialized);
      lastPlan.current = deserialized;
      lastPlanOptions.current = planOptions;
      setIsPlanning(false);
    };
    worker.addEventListener("message", listener);
    return () => {
      worker.terminate();
      worker.removeEventListener("message", listener);
      setIsPlanning(false);
    };
  }, [paths, serialize(planOptions)]);

  return [isPlanning, latestPlan, setPlan];
};