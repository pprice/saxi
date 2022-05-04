import useComponentSize from "@rehooks/component-size";
import React, { ChangeEvent, Fragment, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useReducer, useCallback, FormEvent } from "react";
import ReactDOM, { unstable_renderSubtreeIntoContainer } from "react-dom";
import interpolator from "color-interpolate"
import colormap from "colormap"

import {PaperSize} from "./paper-size";
import {defaultPlanOptions, Device, Plan, PlanOptions, XYMotion } from "./planning";
import {formatDuration} from "./util";

import "./style.css";

import pathJoinRadiusIcon from "./icons/path-joining radius.svg";
import pointJoinRadiusIcon from "./icons/point-joining radius.svg";
import rotateDrawingIcon from "./icons/rotate-drawing.svg";

import { DeviceInfo, Driver, SaxiDriver } from "./drivers";
import { readSvg } from "./helpers/svg";
import { usePlan } from "./hooks/usePlan";
import { PortSelector } from "./components/port-selector";
import { DispatchContext, getInitialState, reducer, State } from "./state";
import { PenHeight } from "./components/pen-height";
import { setPaths } from "./helpers/path";
import { FilePickerButton } from "./components/file-picker-button";
import { MotorControl } from "./components/motor-control";

function VisualizationOptions({state}: {state: State}) {
  const dispatch = useContext(DispatchContext);

  return <>
    <label title="Width of lines in preview. Does not affect plot.">
      visualized stroke width (mm)
      <input
        type="number"
        value={state.visualizationOptions.penStrokeWidth}
        min="0"
        max="10"
        step="0.1"
        onChange={(e) => dispatch({type: "SET_VISUALIZATION_OPTION", value: {penStrokeWidth: Number(e.target.value)}})}
      />
    </label>
    <label className="flex-checkbox" title="Color paths in the preview based on the order in which they will be plotted. Yellow is first, pink is last.">
      <input
        type="checkbox"
        checked={state.visualizationOptions.colorPathsByStrokeOrder}
        onChange={(e) => dispatch({type: "SET_VISUALIZATION_OPTION", value: {colorPathsByStrokeOrder: !!e.target.checked}})}
      />
      color based on order
    </label>
  </>;
}

function SwapPaperSizesButton({ onClick }: { onClick: () => void }) {
  return <svg
    className="paper-sizes__swap"
    xmlns="http://www.w3.org/2000/svg"
    width="14.05"
    height="11.46"
    viewBox="0 0 14.05 11.46"
    onClick={onClick}
  >
    <g>
      <polygon points="14.05 3.04 8.79 0 8.79 1.78 1.38 1.78 1.38 4.29 8.79 4.29 8.79 6.08 14.05 3.04" />
      <polygon points="0 8.43 5.26 11.46 5.26 9.68 12.67 9.68 12.67 7.17 5.26 7.17 5.26 5.39 0 8.43" />
    </g>
  </svg>;
}

function PaperConfig({state}: {state: State}) {
  const dispatch = useContext(DispatchContext);
  const landscape = state.planOptions.paperSize.isLandscape;
  function setPaperSize(e: ChangeEvent) {
    const name = (e.target as HTMLInputElement).value;
    if (name !== "Custom") {
      const ps = PaperSize.standard[name][landscape ? "landscape" : "portrait"];
      dispatch({type: "SET_PLAN_OPTION", value: {paperSize: ps}});
    }
  }
  function setCustomPaperSize(x: number, y: number) {
    dispatch({type: "SET_PLAN_OPTION", value: {paperSize: new PaperSize({x, y})}});
  }
  const {paperSize} = state.planOptions;
  const paperSizeName = Object.keys(PaperSize.standard).find((psName) => {
    const ps = PaperSize.standard[psName].size;
    return (ps.x === paperSize.size.x && ps.y === paperSize.size.y)
      || (ps.y === paperSize.size.x && ps.x === paperSize.size.y);
  }) || "Custom";
  return <div>
    <select
      value={paperSizeName}
      onChange={setPaperSize}
    >
      {Object.keys(PaperSize.standard).map((name) =>
        <option key={name}>{name}</option>
      )}
      <option>Custom</option>
    </select>
    <div className="paper-sizes">
      <label className="paper-label">
        width (mm)
        <input
          type="number"
          value={paperSize.size.x}
          onChange={(e) => setCustomPaperSize(Number(e.target.value), paperSize.size.y)}
        />
      </label>
      <SwapPaperSizesButton onClick={() => {
        dispatch({
          type: "SET_PLAN_OPTION",
          value: {paperSize: paperSize.isLandscape ? paperSize.portrait : paperSize.landscape}
        });
      }} />
      <label className="paper-label">
        height (mm)
        <input
          type="number"
          value={paperSize.size.y}
          onChange={(e) => setCustomPaperSize(paperSize.size.x, Number(e.target.value))}
        />
      </label>
    </div>
    <div>
      <label>
      rotate drawing (degrees)
        <div className="horizontal-labels">
          <img src={rotateDrawingIcon} alt="rotate drawing (degrees)"/>
          <input type="number" min="-90" step="90" max="360" placeholder="0" value={state.planOptions.rotateDrawing}
            onInput={(e) => {
              const value = (e.target as HTMLInputElement).value;
              if (Number(value) < 0) { (e.target as HTMLInputElement).value = "270"; }
              if (Number(value) > 270) { (e.target as HTMLInputElement).value = "0"; }
            }}
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {rotateDrawing: e.target.value}})}/>
        </div>
      </label>
    </div>
    <label>
      margin (mm)
      <input
        type="number"
        value={state.planOptions.marginMm}
        min="0"
        max={Math.min(paperSize.size.x / 2, paperSize.size.y / 2)}
        onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {marginMm: Number(e.target.value)}})}
      />
    </label>
  </div>;
}



function PlanStatistics({plan}: {plan: Plan}) {
  return <div className="duration">
    <div>Duration</div>
    <div><strong>{plan && plan.duration ? formatDuration(plan.duration()) : "-"}</strong></div>
  </div>;
}

function TimeLeft({plan, progress, currentMotionStartedTime, paused}: {
  plan: Plan;
  progress: number | null; 
  currentMotionStartedTime: Date | null;
  paused: boolean;
}) {
  const [_, setTime] = useState(new Date());

  // Interval that ticks every second to rerender
  // and recalculate time remaining for long motions
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    }
  }, [setTime])

  if (!plan || !plan.duration || progress === null || paused) {
    return null;
  }

  const currentMotionTimeSpent = (new Date().getTime() - currentMotionStartedTime.getTime()) / 1000;
  const duration = plan.duration(progress);

  return <div className="duration">
    <div className="time-remaining-label">Time remaining</div>
    <div><strong>{formatDuration(duration - currentMotionTimeSpent)}</strong></div>
  </div>;
}

function PlanPreview(
  {state, previewSize, plan}: {
    state: State;
    previewSize: {width: number; height: number};
    plan: Plan | null;
  }
) {
  const ps = state.planOptions.paperSize;
  const strokeWidth = state.visualizationOptions.penStrokeWidth * Device.Axidraw.stepsPerMm
  const colorPathsByStrokeOrder = state.visualizationOptions.colorPathsByStrokeOrder
  const memoizedPlanPreview = useMemo(() => {
    if (plan) {
      const palette = colorPathsByStrokeOrder
        ? interpolator(colormap({colormap: 'spring'}))
        : () => 'rgba(0, 0, 0, 0.8)'
      const lines = plan.motions.map((m) => {
        if (m instanceof XYMotion) {
          return m.blocks.map((b) => b.p1).concat([m.p2]);
        } else { return []; }
      }).filter((m) => m.length);
      return <g transform={`scale(${1 / Device.Axidraw.stepsPerMm})`}>
        {lines.map((line, i) =>
          <path
            key={i}
            d={line.reduce((m, {x, y}, j) => m + `${j === 0 ? "M" : "L"}${x} ${y}`, "")}
            style={i % 2 === 0 ? {stroke: "rgba(0, 0, 0, 0.3)", strokeWidth: 0.5} : { stroke: palette(1 - i / lines.length), strokeWidth }}
          />
        )}
      </g>;
    }
  }, [plan, strokeWidth, colorPathsByStrokeOrder]);

  // w/h of svg.
  // first try scaling so that h = area.h. if w < area.w, then ok.
  // otherwise, scale so that w = area.w.
  const {width, height} = ps.size.x / ps.size.y * previewSize.height <= previewSize.width
    ? {width: ps.size.x / ps.size.y * previewSize.height, height: previewSize.height}
    : {height: ps.size.y / ps.size.x * previewSize.width, width: previewSize.width};

  const [microprogress, setMicroprogress] = useState(0);
  useLayoutEffect(() => {
    let rafHandle: number = null;
    let cancelled = false;
    if (state.progress != null) {
      const startingTime = Date.now();
      const updateProgress = () => {
        if (cancelled) { return; }
        setMicroprogress(Date.now() - startingTime);
        rafHandle = requestAnimationFrame(updateProgress);
      };
      // rafHandle = requestAnimationFrame(updateProgress)
      updateProgress();
    }
    return () => {
      cancelled = true;
      if (rafHandle != null) {
        cancelAnimationFrame(rafHandle);
      }
      setMicroprogress(0);
    };
  }, [state.progress]);

  let progressIndicator = null;
  if (state.progress != null && plan != null) {
    const motion = plan.motion(state.progress);
    const pos = motion instanceof XYMotion
      ? motion.instant(Math.min(microprogress / 1000, motion.duration())).p
      : (plan.motion(state.progress - 1) as XYMotion).p2;
      
    const {stepsPerMm} = Device.Axidraw;
    const posXMm = pos.x / stepsPerMm;
    const posYMm = pos.y / stepsPerMm;
    progressIndicator =
      <svg
        width={width * 2}
        height={height * 2}
        viewBox={`${-width} ${-height} ${width * 2} ${height * 2}`}
        style={{
          transform: `translateZ(0.001px) ` +
            `translate(${-width}px, ${-height}px) ` +
            `translate(${posXMm / ps.size.x * 50}%,${posYMm / ps.size.y * 50}%)`
        }}
      >
        <g>
          <path
            d={`M-${width} 0l${width * 2} 0M0 -${height}l0 ${height * 2}`}
            style={{stroke: "rgba(222, 114, 114, 0.6)", strokeWidth: 1}}
          />
          <path
            d="M-10 0l20 0M0 -10l0 20"
            style={{stroke: "rgba(222, 114, 114, 1)", strokeWidth: 2}}
          />
        </g>
      </svg>;
  }
  const margins = <g>
    <rect
      x={state.planOptions.marginMm}
      y={state.planOptions.marginMm}
      width={(ps.size.x - state.planOptions.marginMm * 2)}
      height={(ps.size.y - state.planOptions.marginMm * 2)}
      fill="none"
      stroke="black"
      strokeWidth="0.1"
      strokeDasharray="1,1"
    />
  </g>;
  return <div className="preview">
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${ps.size.x} ${ps.size.y}`}
    >
      {memoizedPlanPreview}
      {margins}
    </svg>
    {progressIndicator}
  </div>;
}

function PlanLoader(
  {isLoadingFile, isPlanning}: {
    isLoadingFile: boolean;
    isPlanning: boolean;
  }
) {
  if (isLoadingFile || isPlanning) {
    return <div className="preview-loader">
      {isLoadingFile ? 'Loading file...' : 'Replanning...'}
    </div>;
  }

  return null;
}

function LayerSelector({state}: {state: State}) {
  const dispatch = useContext(DispatchContext);
  const layers = state.planOptions.layerMode === 'group' ? state.groupLayers : state.strokeLayers
  const selectedLayers = state.planOptions.layerMode === 'group' ? state.planOptions.selectedGroupLayers : state.planOptions.selectedStrokeLayers
  if (layers.length <= 1) { return null; }
  const layersChanged = state.planOptions.layerMode === 'group' ?
    (e: ChangeEvent) => {
      const selectedLayers = new Set([...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value));
      dispatch({type: "SET_PLAN_OPTION", value: {selectedGroupLayers: selectedLayers}});
    } :
    (e: ChangeEvent) => {
      const selectedLayers = new Set([...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value));
      dispatch({type: "SET_PLAN_OPTION", value: {selectedStrokeLayers: selectedLayers}});
    };
  return <div>
    <label>
      layers
      <select
        className="layer-select"
        multiple={true}
        value={[...selectedLayers]}
        onChange={layersChanged}
        size={3}
      >
        {layers.map((layer) => <option key={layer}>{layer}</option>)}
      </select>
    </label>
  </div>;
}

function PlotButtons(
  {state, plan, isPlanning, driver}: {
    state: State;
    plan: Plan | null;
    isPlanning: boolean;
    driver: Driver;
  }
) {

  function stop() {
    driver.cancel(true);
  }

  function cancel() {
    driver.cancel(false);
  }

  function pause() {
    driver.pause();
  }
  function resume() {
    driver.resume();
  }
  function plot(plan: Plan) {
    driver.plot(plan);
  }

  return <div>
    {
      isPlanning
        ? <button
          className="replan-button"
          disabled={true}>
          Replanning...
        </button>
        : <button
          className={`plot-button ${state.progress != null ? "plot-button--plotting" : ""}`}
          disabled={plan == null || state.progress != null}
          onClick={() => plot(plan)}>
          {plan && state.progress != null ? "Plotting..." : "Plot"}
        </button>
    }
    <div className={`button-row`}>
      <button
        className={`cancel-button ${state.progress != null ? "cancel-button--active" : ""}`}
        onClick={state.paused ? resume : pause}
        disabled={plan == null || state.progress == null}
      >{state.paused ? "Resume" : "Pause"}</button>
      <button
        className={`cancel-button ${state.progress != null ? "cancel-button--active" : ""}`}
        onClick={cancel}
        disabled={plan == null || state.progress == null}
      >Cancel</button>

      <button
        className={`cancel-button ${state.progress != null ? "cancel-button--active" : ""}`}
        onClick={stop}
        disabled={plan == null || state.progress == null}
      >Stop</button>
    </div>
  </div>;
}

function ResetToDefaultsButton() {
  const dispatch = useContext(DispatchContext);
  const onClick = () => {
    // Clear all user settings that have been saved and reset to the defaults
    window.localStorage.removeItem("planOptions");
    dispatch({type: "SET_PLAN_OPTION", value: {...defaultPlanOptions}});
  };

  return <button className="button-link" onClick={onClick}>reset all options</button>;

}

function PlanOptions({state}: {state: State}) {
  const dispatch = useContext(DispatchContext);
  return <div>
    <label className="flex-checkbox" title="Re-order paths to minimize pen-up travel time">
      <input
        type="checkbox"
        checked={state.planOptions.sortPaths}
        onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {sortPaths: !!e.target.checked}})}
      />
      sort paths
    </label>
    <label className="flex-checkbox" title="Re-scale and position the image to fit on the page">
      <input
        type="checkbox"
        checked={state.planOptions.fitPage}
        onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {fitPage: !!e.target.checked}})}
      />
      fit page
    </label>
    {!state.planOptions.fitPage ?
      <label className="flex-checkbox" title="Remove lines that fall outside the margins">
        <input
          type="checkbox"
          checked={state.planOptions.cropToMargins}
          onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {cropToMargins: !!e.target.checked}})}
        />
        crop to margins
      </label>
      : null}
    <label className="flex-checkbox" title="Split into layers according to group ID, instead of stroke">
      <input
        type="checkbox"
        checked={state.planOptions.layerMode === 'group'}
        onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {layerMode: e.target.checked ? 'group' : 'stroke'}})}
      />
      layer by group
    </label>
    <div className="horizontal-labels">

      <label title="point-joining radius (mm)" >
        <img src={pointJoinRadiusIcon} alt="point-joining radius (mm)"/>
        <input
          type="number"
          value={state.planOptions.pointJoinRadius}
          step="0.1"
          min="0"
          onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {pointJoinRadius: Number(e.target.value)}})}
        />
      </label>
      <label title="path-joining radius (mm)">
        <img src={pathJoinRadiusIcon} alt="path-joining radius (mm)" />
        <input
          type="number"
          value={state.planOptions.pathJoinRadius}
          step="0.1"
          min="0"
          onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {pathJoinRadius: Number(e.target.value)}})}
        />
      </label>
    </div>
    <div>
      <label title="Remove paths that are shorter than this length (in mm)">
        minimum path length
        <input
          type="number"
          value={state.planOptions.minimumPathLength}
          step="0.1"
          min="0"
          onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {minimumPathLength: Number(e.target.value)}})}
        />
      </label>
      <div className="flex">
        <label title="Acceleration when the pen is down (in mm/s^2)">
          down acc. (mm/s<sup>2</sup>)
          <input
            type="number"
            value={state.planOptions.penDownAcceleration}
            step="0.1"
            min="0"
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penDownAcceleration: Number(e.target.value)}})}
          />
        </label>
        <label title="Maximum velocity when the pen is down (in mm/s)">
          down max vel. (mm/s)
          <input
            type="number"
            value={state.planOptions.penDownMaxVelocity}
            step="0.1"
            min="0"
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penDownMaxVelocity: Number(e.target.value)}})}
          />
        </label>
      </div>
      <label>
        cornering factor
        <input
          type="number"
          value={state.planOptions.penDownCorneringFactor}
          step="0.01"
          min="0"
          onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penDownCorneringFactor: Number(e.target.value)}})}
        />
      </label>
      <div className="flex">
        <label title="Acceleration when the pen is up (in mm/s^2)">
          up acc. (mm/s<sup>2</sup>)
          <input
            type="number"
            value={state.planOptions.penUpAcceleration}
            step="0.1"
            min="0"
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penUpAcceleration: Number(e.target.value)}})}
          />
        </label>
        <label title="Maximum velocity when the pen is up (in mm/s)">
          up max vel. (mm/s)
          <input
            type="number"
            value={state.planOptions.penUpMaxVelocity}
            step="0.1"
            min="0"
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penUpMaxVelocity: Number(e.target.value)}})}
          />
        </label>
      </div>
      <div className="flex">
        <label title="How long the pen takes to lift (in seconds)">
          pen lift duration (s)
          <input
            type="number"
            value={state.planOptions.penLiftDuration}
            step="0.01"
            min="0"
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penLiftDuration: Number(e.target.value)}})}
          />
        </label>
        <label title="How long the pen takes to drop (in seconds)">
          pen drop duration (s)
          <input
            type="number"
            value={state.planOptions.penDropDuration}
            step="0.01"
            min="0"
            onChange={(e) => dispatch({type: "SET_PLAN_OPTION", value: {penDropDuration: Number(e.target.value)}})}
          />
        </label>
      </div>
    </div>
  </div>;
}

const INITITAL_STATE = getInitialState();
const INITIAL_DRIVER = IS_WEB ? null as Driver | null : SaxiDriver.connect();

function Root() {
  const [driver, setDriver] = useState(INITIAL_DRIVER);
  const [state, dispatch] = useReducer(reducer, INITITAL_STATE);

  const [isPlanning, plan, setPlan] = usePlan(state.paths, state.planOptions);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("planOptions", JSON.stringify(state.planOptions));
  }, [state.planOptions]);

  useEffect(() => {
    console.log("Driver changed");
    if (driver == null) return;
    driver.onprogress = (motionIdx: number) => {
      dispatch({type: "SET_PROGRESS", motionIdx});
    };
    driver.oncancelled = driver.onfinished = () => {
      dispatch({type: "SET_PROGRESS", motionIdx: null});
    };
    driver.onconnectionchange = (connected: boolean) => {
      dispatch({type: "SET_CONNECTED", connected});
    };
    driver.ondevinfo = (devInfo: DeviceInfo) => {
      dispatch({type: "SET_DEVICE_INFO", value: devInfo});
    };
    driver.onpause = (paused: boolean) => {
      dispatch({type: "SET_PAUSED", value: paused});
    };
    driver.onplan = (plan: Plan) => {
      setPlan(plan);
    };
  }, [driver]);

  const handleRead = useCallback((file: Blob) => { 
    if(!file) {
      // TODO: Show error?
      document.body.classList.remove("dragover");
      return;
    }

    const reader = new FileReader();
    setIsLoadingFile(true);
    setPlan(null);

    function clean() { 
      reader.onload = undefined;
      reader.onerror = undefined;
    }

    reader.onload = () => {
      dispatch(setPaths(readSvg(reader.result as string)));
      setIsLoadingFile(false);
      clean();
    };
    reader.onerror = () => {
      setIsLoadingFile(false);
      clean();
    };

    reader.readAsText(file);
  }, []);

  useEffect(() => {
    const ondrop = (e: DragEvent) => {
      e.preventDefault();
      const item = e.dataTransfer.items[0];
      const file = item.getAsFile();
      handleRead(file);

    };
    const ondragover = (e: DragEvent) => {
      e.preventDefault();

      document.body.classList.add("dragover");
    };
    const ondragleave = (e: DragEvent) => {
      e.preventDefault();
      document.body.classList.remove("dragover");
    };
    const onpaste = (e: ClipboardEvent) => {
      e.clipboardData.items[0].getAsString((s) => {
        dispatch(setPaths(readSvg(s)));
      });
    };
    document.body.addEventListener("drop", ondrop);
    document.body.addEventListener("dragover", ondragover);
    document.body.addEventListener("dragleave", ondragleave);
    document.addEventListener("paste", onpaste);
    return () => {
      document.body.removeEventListener("drop", ondrop);
      document.body.removeEventListener("dragover", ondragover);
      document.body.removeEventListener("dragleave", ondragleave);
      document.removeEventListener("paste", onpaste);
    };
  });

  // Each time new motion is started, save the start time
  const currentMotionStartedTime = useMemo(() => {
    return new Date();
  }, [state.progress, plan, state.paused, handleRead]);

  const previewArea = useRef(null);
  const previewSize = useComponentSize(previewArea);
  const showDragTarget = !plan && !isLoadingFile && !isPlanning;

  return <DispatchContext.Provider value={dispatch}>
    <div className={`root ${state.connected ? "connected" : "disconnected"}`}>
      <div className="control-panel">
        <div className={`saxi-title red`} title={state.deviceInfo ? state.deviceInfo.path : null}>
          <span className="red reg">s</span><span className="teal">axi</span><span className="reg teal-dark">2</span>
        </div>
        {IS_WEB ? <PortSelector driver={driver} setDriver={setDriver} /> : null}
        {!state.connected ? <div className="info-disconnected">disconnected</div> : null}
        <div className="info-disconnected">{state.deviceInfo?.path || "No Device"}</div>
        <div className="section-header">pen</div>
        <div className="section-body">
          <PenHeight state={state} driver={driver} />
          <MotorControl state={state} driver={driver} />
          <ResetToDefaultsButton />
        </div>
        <div className="section-header">paper</div>
        <div className="section-body">
          <PaperConfig state={state} />
          <LayerSelector state={state} />
        </div>
        <details>
          <summary className="section-header">more</summary>
          <div className="section-body">
            <PlanOptions state={state} />
            <VisualizationOptions state={state} />
          </div>
        </details>
        <div className="spacer" />
        <div className="control-panel-bottom">
          <div className="section-header">plot</div>
          <div className="section-body section-body__plot">
            <PlanStatistics plan={plan} />
            <TimeLeft 
              plan={plan} 
              progress={state.progress} 
              currentMotionStartedTime={currentMotionStartedTime}
              paused={state.paused}
            />
            <PlotButtons plan={plan} isPlanning={isPlanning} state={state} driver={driver} />
          </div>
        </div>
      </div>
      <div className="preview-area" ref={previewArea}>
        <PlanPreview
          state={state}
          previewSize={{width: Math.max(0, previewSize.width - 40), height: Math.max(0, previewSize.height - 40)}}
          plan={plan}
        />
        <PlanLoader isPlanning={isPlanning} isLoadingFile={isLoadingFile} />
        {showDragTarget ? <DragTarget /> : null}
        <div className="preview-toolbar">
          <FilePickerButton onFileLoaded={handleRead} />
        </div>
      </div>
    </div>
  </DispatchContext.Provider>;
}

function DragTarget() {

  return <div className="drag-target">
    <div className="drag-target-message">
      Drag SVG here
    </div>
    <div className="drag-target-sub-message">Or open a file using the button above</div>
  </div>;
}

ReactDOM.render(<Root />, document.getElementById("app"));

