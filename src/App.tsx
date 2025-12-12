import React, { SetStateAction, useEffect, useState } from "react";
import { useEntry } from "@frc-web-components/react";
import "@frc-web-components/fwc/components/field3d";

// or to import all components:
import "@frc-web-components/fwc/components";
import './styles/global.css';
import { interpretFMSControlData as interpretControlData } from "./FMSInterpreter";
import CSPField from "./components/CSPField";
import CSPBoolean from "./components/CSPBoolean";
import CSPAutonChooser from "./components/CSPAutonChooser";


interface Item {
  id: string;
  text: string;
}

interface DragInfo {
  draggedId: string;
  selectedIds: string[];
  sourceIndex: number;
}

interface Pose2d {
  x: number;        // meters
  y: number;        // meters
  rotation: number; // radians
}

function parseAdvantageKitPose2d(data: Uint8Array): Pose2d {
  if (!(data instanceof Uint8Array)) {
    console.warn("parseAdvantageKitPose2d: Expected Uint8Array input.");
    return {x: 0, y: 0, rotation: 0};
  }

  if (data.byteLength < 24) {
    console.warn(
      `parseAdvantageKitPose2d: Invalid length (${data.byteLength}). Expected 24 bytes.`
    );
    return {x: 0, y: 0, rotation: 0};
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const x = view.getFloat64(0, true);   // little-endian
  const y = view.getFloat64(8, true);
  const rotation = view.getFloat64(16, true);

  return { x, y, rotation };
}

const initialItems: Item[] = Array.from({ length: 0 }).map((_, i) => ({
  id: `item-${i + 1}`,
  text: `Item ${i + 1}`,
}));

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('none');
  const [sideBarOpen, setSideBarOpen] = useState<boolean>(false);
  const [blink, setBlink] = useState<boolean>(false);

  const defaultBanner = '#0d1821';
  const [bannerStatus, setBannerStatus] = useState<{color: string, blink: boolean}>({color: defaultBanner, blink: false});


  const [autoCommands, setAutoCommands] = useEntry<string[]>('/CSPDashboard/AutoCommands', []);
  const [poseStruct, setPoseStruct] = useEntry<Uint8Array>('/AdvantageKit/RealOutputs/Odometry/Robot', new Uint8Array([...new Array(24).fill(0)]));
  const [fullIntaked, setFullIntaked] = useEntry<boolean>('SETKEYLATER', false);
  const [intakeVolts, setIntakeVolts] = useEntry<number>('SETKEYLATER', 0.0);

  const [atAngle, setAtAngle] = useEntry<boolean>('SETKEYLATER', false);


  useEffect(() => {
    if (intakeVolts > 0.0) setBannerStatus({...bannerStatus, blink: true});
    else setBannerStatus({...bannerStatus, blink: false});

    if (fullIntaked) setBannerStatus({...bannerStatus, color: '#00ff00'});
    else setBannerStatus({...bannerStatus, color: '#ff5c00'});

    // if (!(intakeVolts > 0.0) && !fullIntaked) setBannerStatus({color: '#0d1821', blink: false});

    // setBannerStatus({color: '#ff5c00', blink: true});
    console.log(bannerStatus);

    document.documentElement.style.setProperty('--blink-color', bannerStatus.color);
  }, [intakeVolts, fullIntaked]);

  // NetworkTables Entries

  const [fmsControlData] = useEntry<number>('/FMSInfo/FMSControlData', 0);

  return (
    <div onClick={() => {if (sideBarOpen) setSideBarOpen(false)}} style={{width: '100%', height: '100vh', overflow: 'auto'}}>
      <div className="full-state">
        <div className="state-indicator" style={(interpretControlData(fmsControlData).autonomous) ? {left: '0px', backgroundColor: 'orange'} : {left: '50%', backgroundColor: 'cyan'}}></div>
        <div className="state-back">
          <div>Auton</div>
          <div>TeleOp</div>
        </div>
      </div>
      <div className="full-state" style={{top: '0px', right: '150px'}}>
        <div className="state-indicator" style={(interpretControlData(fmsControlData).enabled) ? {left: '0px', backgroundColor: '#00ff00'} : (true)?{left: '50%', backgroundColor: 'red'}:(blink)?{left: '50%', backgroundColor: 'red'}:{left: '50%', backgroundColor: 'yellow'}}></div>
        <div className="state-back">
          <div>Enabled</div>
          <div>Disabled</div>
        </div>
      </div>
      <div id={'titlebar'}>
        <div className="navbar">
            <img src="../../assets/icons/icon.png" alt="App Logo" className="logo" />
            <span className="app-title">CSP Dashboard</span>
        </div>
        </div>

      {/* Fill Later */}
      <div  className={(bannerStatus.blink)?'top-bar blink':'top-bar no-blink'}>
        
      </div>
      <div className="nav-icon" onClick={() => setSideBarOpen(!sideBarOpen)}>☰</div>

      {/* SideBar */}
      <div className="side-bar" style={(sideBarOpen) ? {height: '400px', padding: '10px', color: 'white'} : {height: '0px', padding: '0px', color: '#023e8a'}}>
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}} onClick={() => setCurrentTab(currentTab=='auton'?'none':'auton')}>Auton Chooser</div>
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}}>Custom Tab</div>
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}}>Embedded DataTable</div>
      </div>

      <div className="tab-container" style={(currentTab=='auton') ? {display: 'flex'} : {display: 'none'}}>
        <CSPAutonChooser setAutoCommands={setAutoCommands}/>
      </div>
      <div className="tab-container-none" style={(currentTab=='none') ? {display: 'flex', position: 'relative'} : {display: 'none'}} onClick={() => console.log(poseStruct, parseAdvantageKitPose2d(poseStruct))}>
          <CSPField robotPose={parseAdvantageKitPose2d(poseStruct)} robotDimensions={{length: 0.762, width: 0.736}} downScale={1}/>
          {/* <ReactP5Wrapper sketch={sketch} eleheight={100} />; */}
          <CSPBoolean value_key={"At Goal?"} state={false} styling={{position: 'absolute', top: 0, right: 15}}/>
          <CSPBoolean value_key={"Shoulder Reached?"} state={true} styling={{position: 'absolute', top: 115, right: 15}}/>
          <CSPBoolean value_key={"Shooter Reached?"} state={false} styling={{position: 'absolute', top: 230, right: 15}}/>
      </div>
    </div>
  )
};

export default App;
