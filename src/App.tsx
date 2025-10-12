import React, { SetStateAction, useEffect, useState, useRef, DragEvent, MouseEvent } from "react";
import { useEntry } from "@frc-web-components/react";
import './styles/global.css';
import { interpretFMSControlData as interpretControlData } from "./FMSInterpreter";

interface Item {
  id: string;
  text: string;
}

interface DragInfo {
  draggedId: string;
  selectedIds: string[];
  sourceIndex: number;
}

const initialItems: Item[] = Array.from({ length: 0 }).map((_, i) => ({
  id: `item-${i + 1}`,
  text: `Item ${i + 1}`,
}));

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [sideBarOpen, setSideBarOpen] = useState<boolean>(false);
  const [blink, setBlink] = useState<boolean>(false);
  
  const [items, setItems] = useState<Item[]>(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const draggingRef = useRef<DragInfo | null>(null);
  const placeholderIndexRef = useRef<number | null>(null);
  const [counter, setCounter] = useState(items.length + 1);

  const [autoCommands, setAutoCommands] = useEntry<string[]>('/CSPDashboard/AutoCommands', []);

  useEffect(() => {
    setAutoCommands(selectionOrder);
  }, [selectionOrder])

  const handleAddItem = (id:string, text:string) => {
    const newItem: Item = {
      id,
      text
    };

    let insertIndex = items.length; // default at end
    if (selectionOrder.length > 0) {
      const lastSelectedId = selectionOrder[selectionOrder.length - 1];
      const lastIndex = items.findIndex((i) => i.id === lastSelectedId);
      if (lastIndex !== -1) insertIndex = lastIndex + 1;
    }

    const newItems = [
      ...items.slice(0, insertIndex),
      newItem,
      ...items.slice(insertIndex),
    ];

    setItems(newItems);
    setCounter(counter + 1);
  };

  const handleClear = () => {
    setItems([]);
    setSelected(new Set());
  };

  // handleAddItem('19343' + counter, 'New Command');

  const updateSelection = (newSet: Set<string>, newOrder?: string[]) => {
    setSelected(newSet);
    if (newOrder) setSelectionOrder(newOrder);
    else setSelectionOrder(Array.from(newSet));
  };

  // Handle item selection
  const handleSelect = (e: MouseEvent<HTMLLIElement>, index: number) => {
  const id = items[index].id;

  // SHIFT-click: range select
  if (e.shiftKey && selected.size > 0) {
    const ids = Array.from(selected);
    const lastId = ids[ids.length - 1];
    const lastIndex = items.findIndex((it) => it.id === lastId);
    const [start, end] = [lastIndex, index].sort((a, b) => a - b);
    const newSet = new Set(selected);
    const newOrder = [...selectionOrder];
    for (let i = start; i <= end; i++) {
      if (!newSet.has(items[i].id)) {
        newSet.add(items[i].id);
        newOrder.push(items[i].id);
      }
    }
    updateSelection(newSet, newOrder);
    return;
  }

  // CTRL/CMD-click: toggle
  if (e.metaKey || e.ctrlKey) {
    const newSet = new Set(selected);
    const newOrder = [...selectionOrder];
    if (newSet.has(id)) {
      newSet.delete(id);
      // remove from order list
      updateSelection(
        newSet,
        newOrder.filter((x) => x !== id)
      );
    } else {
      newSet.add(id);
      updateSelection(newSet, [...newOrder, id]);
    }
    return;
  }

  // Single select
  updateSelection(new Set([id]), [id]);
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

    // Remove dragged items
    const remaining = items.filter((it) => !drag.selectedIds.includes(it.id));

    // Insert dragged items
    const draggedItems = drag.selectedIds.map(
      (id) => items.find((it) => it.id === id)!
    );
    const newItems = [
      ...remaining.slice(0, insertIndex),
      ...draggedItems,
      ...remaining.slice(insertIndex),
    ];

    setItems(newItems);
    setSelected(new Set(drag.selectedIds));
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
        <div className="side-bar-component" style={{borderColor: sideBarOpen?'white':'#023e8a'}} onClick={() => setCurrentTab(currentTab=='auton'?'home':'auton')}>Auton Chooser</div>
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

        <div className="auton-clear" onClick={handleClear}>Clear</div>

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
                        }`}
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
    </div>
  )
};

export default App;
