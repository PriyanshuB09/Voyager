import React, { useEffect, useState } from "react";
import { NetworkTables, NetworkTablesTypeInfos } from "ntcore-ts-client";

// const ntcore = NetworkTables.getInstanceByURI('127.0.0.1');

// const elevatorTopic = ntcore.createTopic<number>('/exampleTable/Elevator Height', NetworkTablesTypeInfos.kDouble);

// elevatorTopic.subscribe((value) => {
//   console.log(`Got elevator height: ${value}`);
// });

const App: React.FC = () => {
  return <div>
    <h1>Hello Dashboard!</h1>
  </div>
  
};

export default App;
