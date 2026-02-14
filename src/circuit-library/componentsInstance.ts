import { Resistor } from "./resistor";
import { Wire } from "./wire";
import { Capacitor } from "./capacitor";
import { Inductor } from "./inductor";
import { VoltageSource } from "./voltageSource";
import { CurrentSource } from "./currentSource";

export const componentMap = {
  resistor: Resistor,
  wire: Wire,
  capacitor: Capacitor,
  inductor: Inductor,
  voltage_source: VoltageSource,
  current_source: CurrentSource,
} as const;

export interface ComponentInstance {
  id: string;
  type: string;
  pinA: { x: number; y: number };
  pinB: { x: number; y: number };
  rotation?: number;
  label?: string;
  value?: string;
  valueUnknown?: boolean;
  current?: string;
  currentUnknown?: boolean;
  voltage?: string;
  voltageUnknown?: boolean;
  sourceDirection?: "a_to_b" | "b_to_a";
  sourcePolarity?: "a_positive" | "b_positive";
}
