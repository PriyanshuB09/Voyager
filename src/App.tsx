import React, { SetStateAction, useEffect, useState } from "react";
import { useEntry } from "@frc-web-components/react";

const App: React.FC = () => {
  const [eleHeight] = useEntry<number>("/AdvantageKit/RealOutputs/Elevator/Height Meters", 0);
  const [autoCommand, setAutoCommand] = useEntry<string[]>("/CSPDashboard/AutoCommands", ["Src"]);

  const addProcessor = () => {
    setAutoCommand(autoCommand.concat(["Processor"]));
  }

  return (
    <div>
      <h1>Welcome to CSP Dashboard!</h1>
      <div>Current Elevator Height: {eleHeight}</div>
      <button onClick={addProcessor}>Add Processor {autoCommand.join(', ')}</button>
    </div>
  )
};

export default App;
