// fmsInterpreter.ts

export type FMSControlDecoded = {
  raw: number;               // raw numeric value (coerced to integer)
  bits: {
    enabled: boolean;       // mask 0x01
    autonomous: boolean;    // mask 0x02
    test: boolean;          // mask 0x04
    eStop: boolean;         // mask 0x08
    fmsAttached: boolean;   // mask 0x10
    dsAttached: boolean;    // mask 0x20
    reserved: number;       // any higher bits packed into a number
  };
  // convenience fields
  enabled: boolean;
  autonomous: boolean;
  test: boolean;
  eStop: boolean;
  fmsAttached: boolean;
  dsAttached: boolean;

  // human readable mode derived from bits
  mode: "estop" | "disabled" | "test" | "autonomous" | "teleop" | "unknown";
  // helper: a short printable summary
  summary: string;
};

/**
 * Masks (matches HAL_ControlWord bitfields in WPILib):
 * bit0 -> enabled (0x01)
 * bit1 -> autonomous (0x02)
 * bit2 -> test (0x04)
 * bit3 -> eStop (0x08)
 * bit4 -> fmsAttached (0x10)
 * bit5 -> dsAttached (0x20)
 */
const MASK_ENABLED = 0x01;
const MASK_AUTONOMOUS = 0x02;
const MASK_TEST = 0x04;
const MASK_ESTOP = 0x08;
const MASK_FMSATTACHED = 0x10;
const MASK_DSATTACHED = 0x20;
const MASK_RESERVED = ~0x3f; // bits above bit5

/**
 * Interpret a NetworkTables FMSControlData value into structured info.
 * NetworkTables often publishes numbers as doubles; this function coerces safely.
 *
 * @param rawValue number | null | undefined - value read from NT (may be double)
 */
export function interpretFMSControlData(rawValue: unknown): FMSControlDecoded {
  // coerce to finite number
  let n = Number(rawValue ?? 0);
  if (!Number.isFinite(n)) n = 0;

  // NT sometimes stores integers as floating point; convert to 32-bit unsigned integer
  // (HAL_ControlWord is a 32-bit bitfield)
  const intVal = n >>> 0; // force to Uint32

  const enabled = (intVal & MASK_ENABLED) !== 0;
  const autonomous = (intVal & MASK_AUTONOMOUS) !== 0;
  const test = (intVal & MASK_TEST) !== 0;
  const eStop = (intVal & MASK_ESTOP) !== 0;
  const fmsAttached = (intVal & MASK_FMSATTACHED) !== 0;
  const dsAttached = (intVal & MASK_DSATTACHED) !== 0;
  const reserved = (intVal & MASK_RESERVED) >>> 6; // higher bits shifted down for reporting

  // Determine mode with clear precedence:
  // 1) eStop has highest priority
  // 2) if not enabled => disabled
  // 3) test => test
  // 4) autonomous => autonomous
  // 5) otherwise enabled & not-autonomous & not-test => teleop
  let mode: FMSControlDecoded["mode"] = "unknown";
  if (eStop) mode = "estop";
  else if (!enabled) mode = "disabled";
  else if (test) mode = "test";
  else if (autonomous) mode = "autonomous";
  else if (enabled) mode = "teleop";

  const summary = `mode=${mode} enabled=${enabled} auto=${autonomous} test=${test} estop=${eStop} fms=${fmsAttached} ds=${dsAttached} raw=0x${intVal.toString(
    16
  )}`;

  return {
    raw: intVal,
    bits: {
      enabled,
      autonomous,
      test,
      eStop,
      fmsAttached,
      dsAttached,
      reserved,
    },
    enabled,
    autonomous,
    test,
    eStop,
    fmsAttached,
    dsAttached,
    mode,
    summary,
  };
}
