// import React, { useState } from "react";
// import { sendAutonCommands } from "../ntcore/client";

// export default function AutonBuilder() {
//   const [commands, setCommands] = useState([]);

//   const addCommand = (cmd) => setCommands((prev) => [...prev, cmd]);
//   const sendToRobot = () => sendAutonCommands(commands);

//   return (
//     <div className="p-4 bg-gray-100 rounded-lg shadow">
//       <h2 className="text-lg font-semibold mb-2">Autonomous Command Builder</h2>

//       <div className="flex gap-2 mb-3">
//         <button onClick={() => addCommand("driveForward")}>Drive Forward</button>
//         <button onClick={() => addCommand("turnRight")}>Turn Right</button>
//         <button onClick={() => addCommand("shoot")}>Shoot</button>
//       </div>

//       <ul className="list-disc ml-6 mb-3">
//         {commands.map((cmd, i) => (
//           <li key={i}>{cmd}</li>
//         ))}
//       </ul>

//       <button
//         onClick={sendToRobot}
//         className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
//       >
//         Send to Robot
//       </button>
//     </div>
//   );
// }