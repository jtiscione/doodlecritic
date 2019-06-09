import React from 'react';
import QuickDraw from './QuickDraw';

// import logo from './logo.svg';

import './App.scss';

function App() {
  return (
    <div className="App">
      {/*
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
      */}
      <header>QUICKDRAW</header>
      <QuickDraw />
    </div>
  );
}

export default App;
