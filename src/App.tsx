import React, { SetStateAction, useEffect, useState } from "react";
import { useEntry } from "@frc-web-components/react";
import "@frc-web-components/fwc/components/field3d";

// or to import all components:
import "@frc-web-components/fwc/components";
import './styles/global.css';
import './styles/font.css';


const fieldImageDimensions = {
  width: 349,
  length: 710
}

const fieldDimensionsInMeters = {
    length: 16.54,
    width: 8.06
}

let correctedPose = {
        length: fieldImageDimensions.length / fieldDimensionsInMeters.length,
        width: fieldImageDimensions.width / fieldDimensionsInMeters.width
}

let robotDimensionsInMeters = {
    length: 0.8382,
    width: 0.8382
}

interface Pose2d {
    x: number;        // meters
    y: number;        // meters
    rotation: number; // radians
}

function parsePose2d(data: Uint8Array): Pose2d {
  if (!(data instanceof Uint8Array)) {
    console.warn("parsePose2d: Expected Uint8Array input.");
    return {x: 0, y: 0, rotation: 0};
  }

  if (data.byteLength < 24) {
    console.warn(
      `parsePose2d: Invalid length (${data.byteLength}). Expected 24 bytes.`
    );
    return {x: 0, y: 0, rotation: 0};
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const x = view.getFloat64(0, true);   // little-endian
  const y = view.getFloat64(8, true);
  const rotation = view.getFloat64(16, true);

  return { x, y, rotation };
}

const App: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [state, setState] = useState<string>("Driver Station");
  const [poseStruct, setPoseStruct] = useEntry<Uint8Array>('/AdvantageKit/RealOutputs/Odometry/Robot', new Uint8Array([...new Array(24).fill(0)]));

  const [brownOut, setBrownOut] = useEntry<boolean>('/AdvantageKit/SystemStats/BrownedOut', false);
  const [connected, setConnected] = useEntry<boolean>('/AdvantageKit/DriverStation/DSAttached', false);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setProgress((prevProgress: number) => (prevProgress >= 100 ? 0 : prevProgress + 0.1));
  //   }, 1);

  //   return () => clearInterval(interval);
  // }, []);

  return (
    <div className="w-full h-[100vh] flex flex-col">
      <div className="w-full h-[42px] draggable bg-[#002c65] select-none fixed z-10">
        <div className="absolute top-0 left-0 h-[39px] w-10 flex items-center justify-center px-10 mx-10">
          <img src="./assets/icons/Group 1.png" alt="App Icon" className="w-5 h-5 ml-2" />
        </div>
        <div className="absolute top-0 left-20 h-[40px] w-[400px] flex items-center justify-evenly px-[10px] mx-[10px]">
          <div className={`text-white font-bold w-[30px] h-[30px] ${brownOut ? "bg-[#DB8712]" : "bg-[#0f1720]"} items-center text-center justify-center flex rounded-full`}><i className="fa-solid fa-battery-low"></i></div>
          <div className={`text-white font-bold w-[30px] h-[30px] ${connected ? "bg-[#54B510]" : "bg-[#0f1720]"} items-center text-center justify-center flex rounded-full`}><i className="fa-solid fa-wifi-slash"></i></div>
          <div className="text-white font-semibold w-[100px] h-[30px] bg-[#0f1720] items-center text-center justify-center flex rounded-full">Auto</div>
          <div className="text-white font-semibold w-[100px] h-[30px] bg-[#0f1720] items-center text-center justify-center flex rounded-full">Tele</div>
          <div className="text-white font-semibold w-[100px] h-[30px] bg-[#0f1720] items-center text-center justify-center flex rounded-full">End</div>
        </div>

        <div className="absolute top-0 right-50 h-[40px] w-[500px] flex items-center justify-evenly px-[10px] mx-[10px]">
          <div className="text-white font-semibold w-[500px] h-[30px] bg-[#0f1720] items-center text-center justify-center flex rounded-full">Time Left: -1</div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-full z-20 transition-opacity duration-1 ease-in-out" style={{ display: state == "Task Selector" ? "block" : "none"}}>
        <div className="absolute top-[40px] left-0 w-full h-[calc(100vh-40px)] bg-black z-20 backdrop-blur-sm opacity-70"></div>
        <div className="absolute top-[80px] left-[5%] w-[85%] h-[calc(100vh-140px)] bg-[#1B548F] z-30 rounded-md border-2 border-white flex flex-col items-center justify-flex-start">
          <img src="../assets/images/FE-2026-_REBUILT_Playing_Field_With_Fuel_Clipped_Rotated.png" alt="Field 2D" className="field2 object-cover" />
        </div>
      </div>

      <div className="absolute bottom-10 right-10 w-10 h-10 bg-[#1B548F] rounded-full border-2 border-white flex justify-center text-center items-center text-white z-999" 
      onClick={() => setState(state == "Task Selector" ? "Driver Station" : "Task Selector")}>
        {(state == "Driver Station" ? <i className="fa-solid fa-chart-diagram"></i> : <i className="fa-solid fa-table"></i>) }
      </div>

      <div className="w-full h-[100vh] bg-[#0f1720] text-white">
        <div className="absolute top-[40px] left-[0px] overflow-hidden rotate-180">
          <img src="../assets/images/FE-2026-_REBUILT_Playing_Field_Clipped.png" alt="Field 2D" className="field object-cover rotate-180" />
          <div style={{
            position: 'absolute',
            top: correctedPose.length * (poseStruct ? parsePose2d(poseStruct).x: 0),
            left: correctedPose.width * (poseStruct ? parsePose2d(poseStruct).y: 0),
            width: robotDimensionsInMeters.width * correctedPose.width,
            height: robotDimensionsInMeters.length * correctedPose.length,
            backgroundColor: "black",
            color: 'white',
            boxSizing: 'border-box',
            border: `${correctedPose.length * 0.0762}px solid red`,
            transform: 'translate(-50%, -50%) rotate(' + (((poseStruct ? parsePose2d(poseStruct).rotation : 0) * -180 / Math.PI) + 90) + 'deg)',
          }}>
            <i style={{
                fontSize: 20,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'}}>-|</i>
          </div>
        </div>  
        <div className="absolute top-[50px] right-[0px] w-[72vw] h-100">
          <div className="absolute w-[71vw] h-[92vh]">
            <div className="bg-[#1B548F] w-[100%] h-[60px] rounded-md absolute top-0 left-0">
              <div className="w-full h-[10px] bg-black absolute top-[25px] left-0"></div>
              <div className={`w-[20px] h-[20px] ${progress > 12.5 ? 'bg-green-400' : 'bg-black'} rounded-full absolute top-[20px] left-[12.5%]`}></div>
              <div className={`w-[20px] h-[20px] ${progress > 18.75 ? 'bg-green-400' : 'bg-black'} rounded-full absolute top-[20px] left-[18.75%]`}></div>
              <div className={`w-[20px] h-[20px] ${progress > 34.375 ? 'bg-green-400' : 'bg-black'} rounded-full absolute top-[20px] left-[34.375%]`}></div>
              <div className={`w-[20px] h-[20px] ${progress > 50 ? 'bg-green-400' : 'bg-black'} rounded-full absolute top-[20px] left-[50%]`}></div> 
              <div className={`w-[20px] h-[20px] ${progress > 65.625 ? 'bg-green-400' : 'bg-black'} rounded-full absolute top-[20px] left-[65.625%]`}></div>
              <div className={`w-[20px] h-[20px] ${progress > 81.25 ? 'bg-green-400' : 'bg-black'} rounded-full absolute top-[20px] left-[81.25%]`}></div>
              <div className={`h-[10px] bg-green-400 absolute top-[25px] left-0`} style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
