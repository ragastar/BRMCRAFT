import "./styles.css";
import "./box.css";
import { createBox } from "./box.js";

window.__box = createBox(document.getElementById("box"));
