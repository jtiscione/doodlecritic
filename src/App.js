import React from 'react';
import QuickDraw from './QuickDraw';

import './App.scss';

function App() {
  return (
    <div className="App">
      <QuickDraw />
      <footer>
        <div className="leftEnd">Jason Tiscione</div>
        <div className="center"></div>
        <div className="rightEnd"><a href="http://github.com/jtiscione/doodle-recognition">Github repository</a></div>
      </footer>
    </div>
  );
}

export default App;
