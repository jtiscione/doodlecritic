import React from 'react';
import QuickDraw from './QuickDraw';

import './App.scss';

function App() {
  return (
    <div className="App">
      <QuickDraw />
      <footer>
        <div className="leftEnd">LEFT SIDE</div>
        <div className="center">CENTER TEXT</div>
        <div className="rightEnd">RIGHT SIDE</div>
      </footer>
    </div>
  );
}

export default App;
