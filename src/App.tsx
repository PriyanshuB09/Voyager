import React, { SetStateAction, useEffect, useState, useRef, DragEvent, MouseEvent } from "react";
import { Field3d, Field3dObject, Field3dPoseVisualizer, useEntry } from "@frc-web-components/react";
import { Field, FieldPath, FieldRobot } from "@frc-web-components/react";
import "@frc-web-components/fwc/components/field3d";

// or to import all components:
import "@frc-web-components/fwc/components";
import './styles/global.css';
import { interpretFMSControlData as interpretControlData } from "./FMSInterpreter";
import CSPField from "./components/CSPField";

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
  
  const [items, setItems] = useState<Item[]>(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const draggingRef = useRef<DragInfo | null>(null);
  const placeholderIndexRef = useRef<number | null>(null);
  const [counter, setCounter] = useState(items.length + 1);
  const lastClickedIndexRef = useRef<number | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);


  const [autoCommands, setAutoCommands] = useEntry<string[]>('/CSPDashboard/AutoCommands', []);

  const [poseStruct, setPoseStruct] = useEntry<Uint8Array>('/AdvantageKit/RealOutputs/Odometry/Robot', new Uint8Array([...new Array(24).fill(0)]));

  useEffect(() => {
    setAutoCommands(selectionOrder);
    console.log('AutoCommands set to:', selectionOrder);
  }, [selectionOrder])

  useEffect(() => {
    setSelectionOrder(items.map((it) => it.text));
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") setDeleteMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") setDeleteMode(false);
    };
  
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  

  const handleAddItem = (id: string, text: string) => {
    const newItem: Item = { id, text };
  
    // Try to insert after the last selected item (by id), otherwise append
    let insertIndex = items.length;
    if (selected.size > 0) {
      const lastSelectedId = Array.from(selected).pop()!;
      const lastIndex = items.findIndex(i => i.id === lastSelectedId);
      if (lastIndex !== -1) insertIndex = lastIndex + 1;
    }
  
    const newItems = [
      ...items.slice(0, insertIndex),
      newItem,
      ...items.slice(insertIndex),
    ];
  
    setItems(newItems);
    setSelectionOrder(newItems.map(it => it.text)); // ✅ keep texts synced
    setCounter(counter + 1);
  };
  
  
  
  const handleClear = () => {
    setItems([]);
    setSelected(new Set());
    setSelectionOrder([]); // ✅ clear texts too
  };

  // handleAddItem('19343' + counter, 'New Command');

  const updateSelection = (newSet: Set<string>, newOrder?: string[]) => {
    setSelected(newSet);
    if (newOrder) setSelectionOrder(newOrder);
    else setSelectionOrder(Array.from(newSet));
  };

  const handleSelect = (e: React.MouseEvent<HTMLLIElement>, index: number) => {
    const id = items[index].id;
    const text = items[index].text;
  
    // 🗑️ If in delete mode, delete instead of selecting
    if (deleteMode) {
      e.preventDefault();
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      setSelectionOrder(newItems.map(it => it.text));
      setSelected((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }
  
    // 🧩 otherwise proceed with your normal selection logic...
    if (!e.shiftKey) {
      lastClickedIndexRef.current = index;
    }
  
    if (e.shiftKey && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
  
      const rangeIds = items.slice(start, end + 1).map(it => it.id);
      const newSet = new Set(selected);
      const newOrder = [...selectionOrder];
  
      for (const rid of rangeIds) {
        if (!newSet.has(rid)) {
          newSet.add(rid);
          newOrder.push(items.find(it => it.id === rid)!.text);
        }
      }
  
      updateSelection(newSet, newOrder);
      return;
    }
  
    if (e.ctrlKey || e.metaKey) {
      const newSet = new Set(selected);
      const newOrder = [...selectionOrder];
  
      if (newSet.has(id)) {
        newSet.delete(id);
        const idx = newOrder.indexOf(text);
        if (idx !== -1) newOrder.splice(idx, 1);
      } else {
        newSet.add(id);
        newOrder.push(text);
      }
  
      updateSelection(newSet, newOrder);
      return;
    }
  
    updateSelection(new Set([id]), [text]);
  };
  
  
  

  // Drag start
  const onDragStart = (e: DragEvent<HTMLLIElement>, index: number) => {
    const id = items[index].id;
    const selectedIds =
      selected.size && selected.has(id) ? Array.from(selected) : [id];
    const orderedSelected = items
      .filter((it) => selectedIds.includes(it.id))
      .map((it) => it.id);

    draggingRef.current = {
      draggedId: id,
      selectedIds: orderedSelected,
      sourceIndex: index,
    };

    // Optional drag preview
    const dragGhost = document.createElement("div");
    dragGhost.className = "drag-ghost";
    dragGhost.innerText = `${orderedSelected.length} item${
      orderedSelected.length > 1 ? "s" : ""
    }`;
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, -10, -10);
    setTimeout(() => document.body.removeChild(dragGhost), 0);

    e.dataTransfer.effectAllowed = "move";
    placeholderIndexRef.current = index;
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>, overIndex: number) => {
    e.preventDefault();
    const drag = draggingRef.current;
    if (!drag) return;

    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    const insertIndex = before ? overIndex : overIndex + 1;

    placeholderIndexRef.current = insertIndex;
    setItems((s) => [...s]); // trigger rerender
  };

  const onDrop = (e: DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    const drag = draggingRef.current;
    if (!drag) return;
    let insertIndex = placeholderIndexRef.current ?? items.length;
  
    const remaining = items.filter((it) => !drag.selectedIds.includes(it.id));
    const draggedItems = drag.selectedIds.map((id) => items.find((it) => it.id === id)!);
    const newItems = [
      ...remaining.slice(0, insertIndex),
      ...draggedItems,
      ...remaining.slice(insertIndex),
    ];
  
    setItems(newItems);
    setSelected(new Set(drag.selectedIds));
    setSelectionOrder(newItems.map((it) => it.text)); // ✅ now text-based
    draggingRef.current = null;
    placeholderIndexRef.current = null;
  };
  
  

  const onDragEnd = () => {
    draggingRef.current = null;
    placeholderIndexRef.current = null;
    setItems((s) => [...s]); // rerender to clear placeholder
  };

  const placeholderIndex = placeholderIndexRef.current;

  useEffect(() => {
    setInterval(() => {
      setBlink(!blink);
    }, 750);
  }, []);

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
      <div id="titlebar" className={`titlebar`}>
        <div className="navbar">
            <img src="../../assets/icons/icon.png" alt="App Logo" className="logo" />
            <span className="app-title">CSP Dashboard</span>
        </div>
        </div>

      {/* Fill Later */}
      <div className="top-bar">
        
      </div>
      <div className="nav-icon" onClick={() => setSideBarOpen(!sideBarOpen)}>☰</div>

      {/* SideBar */}
      <div className="side-bar" style={(sideBarOpen) ? {height: '400px', padding: '10px', color: 'white'} : {height: '0px', padding: '0px', color: '#023e8a'}}>
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}} onClick={() => setCurrentTab(currentTab=='auton'?'none':'auton')}>Auton Chooser</div>
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}}>Custom Tab</div>
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}}>Embedded DataTable</div>
      </div>

      <div className="tab-container" style={(currentTab=='auton') ? {display: 'flex'} : {display: 'none'}}>
        <div className="image-div">
          <img src="../../assets/images/reefscape-field.png" alt="field" className="field-image" />
        </div>

        <div className="auton-location" style={{right: "250px", bottom: "350px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src Brg')}>B</div>
        <div className="auton-location" style={{right: "200px", bottom: "325px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src Brg Right')}>BR</div>
        <div className="auton-location" style={{right: "300px", bottom: "325px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src Brg Left')}>BL</div>
        <div className="auton-location" style={{right: "200px", bottom: "260px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src Ally Right')}>AR</div>
        <div className="auton-location" style={{right: "300px", bottom: "260px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src Ally Left')}>AL</div>
        <div className="auton-location" style={{right: "250px", bottom: "235px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src Ally')}>A</div>
        <div className="auton-location" style={{right: "250px", bottom: "290px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Src')}>RS</div>

        <div className="auton-location" style={{right: "430px", bottom: "450px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Net Left')}>L</div>
        <div className="auton-location" style={{right: "370px", bottom: "450px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Net Mid')}>M</div>
        <div className="auton-location" style={{right: "310px", bottom: "450px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Net Right')}>R</div>
        <div className="auton-location" style={{right: "370px", bottom: "520px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Net')}>N</div>

        <div className="auton-location" style={{right: "50px", bottom: "375px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Processor')}>P</div>

        <div className="auton-location" style={{right: "525px", bottom: "525px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Delay')}>W</div>
        <div className="auton-location" style={{right: "525px", bottom: "475px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Push Left')}>PL</div>
        <div className="auton-location" style={{right: "525px", bottom: "425px", transform: 'rotateZ(0deg)'}} onClick={() => handleAddItem(`${Math.floor(Math.random() * 100000)}-${counter}`, 'Push Right')}>PR</div>

        {/* <div className="auton-clear" onClick={handleClear}>Clear</div> */}
        {/* <div className="auton-submit" onClick={()=>setAutoCommands([...items].map(el => el.text))}>Submit</div> */}

        <div className="current-auton">
            <div className="app">
              <h2>Command Chain</h2>
              <p className="hint">
                Ctrl/Cmd + click to toggle, Shift + click for range. Drag a selected
                item to move the entire chain.
              </p>

              <ul className="list" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
                {items.map((item, idx) => {
                  const showPlaceholderBefore = placeholderIndex === idx;
                  return (
                    <React.Fragment key={item.id}>
                      {showPlaceholderBefore && <li className="placeholder" />}
                      <li
                        draggable
                        className={`list-item ${
                          selected.has(item.id) ? "selected" : ""
                        } ${deleteMode ? "delete-mode" : ""}`}
                        onClick={(e) => handleSelect(e, idx)}
                        onDragStart={(e) => onDragStart(e, idx)}
                        onDragOver={(e) => onDragOver(e, idx)}
                        onDragEnd={onDragEnd}
                      >
                        <div className="handle">≡</div>
                        <div className="content">{item.text}</div>
                        <div className="meta">
                          {selected.has(item.id) ? "selected" : ""}
                        </div>
                      </li>
                    </React.Fragment>
                  );
                })}
                {placeholderIndex === items.length && <li className="placeholder" />}
              </ul>
            </div>
        </div>
      </div>
      <div className="tab-container-none" style={(currentTab=='none') ? {display: 'flex', position: 'relative'} : {display: 'none'}} onClick={() => console.log(poseStruct, parseAdvantageKitPose2d(poseStruct))}>
          <CSPField robotPose={parseAdvantageKitPose2d(poseStruct)} robotDimensions={{length: 0.762, width: 0.736}} downScale={0.5}/>
      </div>
    </div>
  )
};

export default App;
