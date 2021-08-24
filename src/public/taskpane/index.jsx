import "office-ui-fabric-react/dist/css/fabric.min.css";
import App from "./components/App";
//import { AppContainer } from "react-hot-loader";
import { initializeIcons } from "office-ui-fabric-react/lib/Icons";
import * as React from "react";
import * as ReactDOM from "react-dom";
/* global document, Office, module, require */

initializeIcons();

let isOfficeInitialized = false;

const title = "Nanoart Task Pane Add-in";


const render = (Component) => {
  ReactDOM.render(
      <Component title={title} isOfficeInitialized={isOfficeInitialized} />,
    document.getElementById("container")
  );
};


/* Render application after Office initializes */
Office.initialize = () => {
  isOfficeInitialized = true;
//  render(App);
  ReactDOM.render(
    <App title={title} isOfficeInitialized={isOfficeInitialized} />,
  document.getElementById("container")
  );
};

/* Initial render showing a progress bar */
//render(App);



/*
ReactDOM.render(
  <App title={title} isOfficeInitialized={isOfficeInitialized} />,
document.getElementById("container")
);

if (module.hot) {
  module.hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    render(NextApp);
  });
}
*/

