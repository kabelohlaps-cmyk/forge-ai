export interface SketchPart {
  id: string;
  label: string;
  category: string;
  url: string;
}

export const SKETCH_PARTS: SketchPart[] = [
  {
    id: "mecha-arm",
    label: "Arm",
    category: "mecha",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMDAiIGN5PSIyOCIgcj0iMTYiLz48cmVjdCB4PSI4MiIgeT0iNDQiIHdpZHRoPSIzNiIgaGVpZ2h0PSI1NSIgcng9IjEyIi8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMTA2IiByPSIxNCIvPjxyZWN0IHg9Ijg2IiB5PSIxMjAiIHdpZHRoPSIyOCIgaGVpZ2h0PSI1MCIgcng9IjEwIi8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMTcyIiByPSIxMCIvPjxyZWN0IHg9IjgyIiB5PSIxNzgiIHdpZHRoPSIzNiIgaGVpZ2h0PSIxNCIgcng9IjQiLz48cGF0aCBkPSJNODgsMTkyIEw4OCwxNzggTTEwMCwxOTMgTDEwMCwxNzggTTExMiwxOTIgTDExMiwxNzgiLz48L2c+PC9zdmc+",
  },
  {
    id: "mecha-head",
    label: "Head",
    category: "mecha",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNzUsNDAgTDEyNSw0MCBMMTQ1LDc1IEwxMzgsMTU1IEwxMTUsMTc1IEw4NSwxNzUgTDYyLDE1NSBMNTUsNzUgWiIvPjxwYXRoIGQ9Ik02NSw5NSBMMTM1LDk1Ii8+PHBhdGggZD0iTTEwMCw0MCBMMTAwLDI1Ii8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMjIiIHI9IjQiLz48L2c+PC9zdmc+",
  },
  {
    id: "mecha-thruster",
    label: "Thruster",
    category: "mecha",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNOTAsMzAgTDExMCwzMCBMMTI1LDcwIEwxNTAsMTUwIFExNTAsMTY1IDEzMCwxNjUgTDcwLDE2NSBRNTAsMTY1IDUwLDE1MCBMNzUsNzAgWiIvPjxwYXRoIGQ9Ik02NiwxMDAgTDEzNCwxMDAiLz48cGF0aCBkPSJNNTgsMTI1IEwxNDIsMTI1Ii8+PHBhdGggZD0iTTUyLDE0NSBMMTQ4LDE0NSIvPjwvZz48L3N2Zz4=",
  },
  {
    id: "wheel",
    label: "Wheel",
    category: "vehicle",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9Ijc1Ii8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMTAwIiByPSIyNSIvPjxwYXRoIGQ9Ik0xMDAsNzUgTDEwMCwyNSIvPjxwYXRoIGQ9Ik0xMjQsOTIgTDE3MSw3NyIvPjxwYXRoIGQ9Ik0xMTUsMTIwIEwxNDQsMTYxIi8+PHBhdGggZD0iTTg1LDEyMCBMNTYsMTYxIi8+PHBhdGggZD0iTTc2LDkyIEwyOSw3NyIvPjwvZz48L3N2Zz4=",
  },
  {
    id: "vehicle-panel",
    label: "Body Panel",
    category: "vehicle",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNTAsNjAgQzkwLDQwIDE0MCw0NSAxNjAsODAgQzE3NSwxMTAgMTY1LDE1MCAxMzAsMTY1IEw3MCwxNjUgQzQwLDE1MCAzNSwxMDAgNTAsNjAgWiIvPjxwYXRoIGQ9Ik03MCwxNjUgQTU1LDU1IDAgMCAxIDEzMCwxNjUiLz48L2c+PC9zdmc+",
  },
  {
    id: "vehicle-window",
    label: "Window",
    category: "vehicle",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzNSIgeT0iNTUiIHdpZHRoPSIxMzAiIGhlaWdodD0iOTAiIHJ4PSIyNSIvPjxwYXRoIGQ9Ik02MCw4MCBMODUsMTM1Ii8+PHBhdGggZD0iTTc1LDgwIEwxMDAsMTM1Ii8+PC9nPjwvc3ZnPg==",
  },
  {
    id: "character-hand",
    label: "Hand",
    category: "character",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSI2NSIgeT0iMTEwIiB3aWR0aD0iNzAiIGhlaWdodD0iNzAiIHJ4PSIyNSIvPjxyZWN0IHg9IjY1IiB5PSI1MCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjYyIiByeD0iNyIvPjxyZWN0IHg9Ijg0IiB5PSI0MCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjcyIiByeD0iNyIvPjxyZWN0IHg9IjEwMyIgeT0iNDIiIHdpZHRoPSIxNCIgaGVpZ2h0PSI3MCIgcng9IjciLz48cmVjdCB4PSIxMjIiIHk9IjUyIiB3aWR0aD0iMTQiIGhlaWdodD0iNjAiIHJ4PSI3Ii8+PHJlY3QgeD0iMzAiIHk9IjEwMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjE2IiByeD0iOCIgdHJhbnNmb3JtPSJyb3RhdGUoLTM1IDY1IDExNSkiLz48L2c+PC9zdmc+",
  },
  {
    id: "character-eye",
    label: "Eye",
    category: "character",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNDAsMTAwIFExMDAsNjAgMTYwLDEwMCBRMTAwLDE0MCA0MCwxMDAgWiIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMjIiLz48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjgiIGZpbGw9IiM4YThhOGEiLz48L2c+PC9zdmc+",
  },
  {
    id: "tree-simple",
    label: "Tree",
    category: "environment",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSI5MCIgeT0iMTQwIiB3aWR0aD0iMjAiIGhlaWdodD0iNTAiIHJ4PSI0Ii8+PHBhdGggZD0iTTYwLDE0MCBRNDAsMTQwIDQwLDExNSBRNDAsOTAgNjUsOTAgUTY1LDYwIDEwMCw2MCBRMTM1LDYwIDEzNSw5MCBRMTYwLDkwIDE2MCwxMTUgUTE2MCwxNDAgMTQwLDE0MCBaIi8+PC9nPjwvc3ZnPg==",
  },
  {
    id: "crate",
    label: "Crate",
    category: "environment",
    url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YThhOGEiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTAwLDUwIEw1MCw4MCBMNTAsMTQwIEwxMDAsMTcwIEwxNTAsMTQwIEwxNTAsODAgWiIvPjxwYXRoIGQ9Ik01MCw4MCBMMTAwLDExMCBMMTUwLDgwIi8+PHBhdGggZD0iTTEwMCwxMTAgTDEwMCwxNzAiLz48L2c+PC9zdmc+",
  },
];
