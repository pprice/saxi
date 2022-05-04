import React from "react";
import { Driver } from "../drivers";
import { Device } from "../planning";
import { State } from "../state";

export function MotorControl({state, driver}: {state: State, driver: Driver}) {
  const {penUpHeight} = state.planOptions;

  const goHomeHandler = () => { 
    const height = Device.Axidraw.penPctToPos(penUpHeight);
    driver.goHome(height, 1000)
  }

  return <div>
    <button onClick={() => driver.limp()}>disengage motors</button>
    <button onClick={goHomeHandler}>go home</button>
  </div>;
}