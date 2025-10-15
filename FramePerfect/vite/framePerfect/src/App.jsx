import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CharacterSelect from './pages/CharacterSelect.jsx';

import ComboMaker from './pages/ComboMaker.jsx';   // builder ikon (baru)
import Moves from './pages/Moves.jsx';
import Calculator from './pages/Calculator.jsx';
import Playlist from './pages/Playlist.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Characters</Link>
        <Link to="/combo">Combo Maker</Link>
        <Link to="/calculator">Calculator</Link>
      </nav>

      <Routes>
        <Route path="/" element={<CharacterSelect />} />
        <Route path="/moves" element={<Moves />} />
        <Route path="/moves/:char" element={<Moves />} />
        <Route path="/playlist" element={<Playlist />} /> 

        <Route path="/combo" element={<ComboMaker />} />
        <Route path="/combo/:char" element={<ComboMaker />} />

        <Route path="/calculator" element={<Calculator />} />
      </Routes>
    </BrowserRouter>
  );
}