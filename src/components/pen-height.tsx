import React, { Fragment } from "react";
import { useContext } from "react";
import { Driver } from "../drivers";
import { Device } from "../planning";
import { DispatchContext, State } from "../state";

export function PenHeight({state, driver}: {state: State; driver: Driver}) {
  const {penUpHeight, penDownHeight} = state.planOptions;
  const dispatch = useContext(DispatchContext);
  const setPenUpHeight = (x: number) => dispatch({type: "SET_PLAN_OPTION", value: {penUpHeight: x}});
  const setPenDownHeight = (x: number) => dispatch({type: "SET_PLAN_OPTION", value: {penDownHeight: x}});
  const penUp = () => {
    const height = Device.Axidraw.penPctToPos(penUpHeight);
    driver.setPenHeight(height, 1000);
  };
  const penDown = () => {
    const height = Device.Axidraw.penPctToPos(penDownHeight);
    driver.setPenHeight(height, 1000);
  };
  
  return <Fragment>
    <div className="flex">
      <label className="pen-label">
        up height (%)
        <input type="number" min="0" max="100"
          value={penUpHeight}
          onChange={(e) => setPenUpHeight(parseInt(e.target.value, 10))}
        />
      </label>
      <label className="pen-label">
        down height (%)
        <input type="number" min="0" max="100"
          value={penDownHeight}
          onChange={(e) => setPenDownHeight(parseInt(e.target.value, 10))}
        />
      </label>
    </div>
    <div className="flex">
      <button onClick={penUp}>pen up</button>
      <button onClick={penDown}>pen down</button>
    </div>
  </Fragment>;
}
