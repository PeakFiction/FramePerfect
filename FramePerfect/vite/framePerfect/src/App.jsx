import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import CharacterSelect from "./pages/CharacterSelect";
import Moves from "./pages/Moves";
import Playlist from "./pages/Playlist";
import Calculator from "./pages/Calculator";
import ComboMaker from "./pages/ComboMaker";
/* comment */
function Nav() {
  const loc = useLocation();
  const active = (to) => (loc.pathname === to ? "active" : undefined);
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <div className="brand">FRAME<span>PERFECT</span></div>
        <div className="menu">
          <Link className={active("/")} to="/">Fighters</Link>
          <Link className={active("/calculator")} to="/calculator">Damage</Link>
          <Link className={active("/combomaker")} to="/combomaker">Combo Maker</Link>
          <Link className={active("/playlist")} to="/playlist">Playlist</Link>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<CharacterSelect />} />
        <Route path="/moves" element={<Moves />} />
        <Route path="/playlist" element={<Playlist />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/combomaker" element={<ComboMaker />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
