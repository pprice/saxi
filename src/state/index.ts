import React from "react";
import { DeviceInfo } from "../drivers";
import { PaperSize } from "../paper-size";
import { defaultPlanOptions, PlanOptions } from "../planning";
import { Vec2 } from "../vec";




// Update the initial state with previously persisted settings (if present)

export type State = ReturnType<typeof getInitialState>;

export function getInitialState() { 
  const defaultVisualizationOptions = {
    penStrokeWidth: 0.5,
    colorPathsByStrokeOrder: false,
  }

  
  const initialState = {
    connected: true,
  
    paused: false,
  
    deviceInfo: null as DeviceInfo | null,
  
    // UI state
    planOptions: defaultPlanOptions,
    visualizationOptions: defaultVisualizationOptions,
  
    // Options used to produce the current value of |plan|.
    plannedOptions: null as PlanOptions | null,
  
    // Info about the currently-loaded SVG.
    paths: null as Vec2[][] | null,
    groupLayers: [] as string[],
    strokeLayers: [] as string[],
  
    // While a plot is in progress, this will be the index of the current motion.
    progress: (null as number | null),
  };

  const persistedPlanOptions = JSON.parse(window.localStorage.getItem("planOptions")) || {};
  initialState.planOptions = {...initialState.planOptions, ...persistedPlanOptions};
  initialState.planOptions.paperSize = new PaperSize(initialState.planOptions.paperSize.size);

  return initialState;
}

export const DispatchContext = React.createContext(null);

export function reducer(state: State, action: any): State {
  switch (action.type) {
    case "SET_PLAN_OPTION":
      return {...state, planOptions: {...state.planOptions, ...action.value}};
    case "SET_VISUALIZATION_OPTION":
      return {...state, visualizationOptions: {...state.visualizationOptions, ...action.value}};
    case "SET_DEVICE_INFO":
      return {...state, deviceInfo: action.value};
    case "SET_PAUSED":
      return {...state, paused: action.value};
    case "SET_PATHS":
      const {paths, strokeLayers, selectedStrokeLayers, groupLayers, selectedGroupLayers, layerMode} = action;
      return {...state, paths, groupLayers, strokeLayers, planOptions: {...state.planOptions, selectedStrokeLayers, selectedGroupLayers, layerMode}};
    case "SET_PROGRESS":
      return {...state, progress: action.motionIdx};
    case "SET_CONNECTED":
      return {...state, connected: action.connected};
    default:
      console.warn(`Unrecognized action type '${action.type}'`);
      return state;
  }
}