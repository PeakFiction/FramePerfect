import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CharacterSelect from './pages/CharacterSelect.jsx';

import ComboMaker from './pages/ComboMaker.jsx';   // builder ikon (baru)
import Moves from './pages/Moves.jsx';
import Calculator from './pages/Calculator.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Characters</Link>
        <Link to="/combo">Combo Maker</Link>
        <Link to="/calculator">Calculator</Link>
      </nav>

      <Routes>
        {/* Home: daftar karakter */}
        <Route path="/" element={<CharacterSelect />} />

        {/* Halaman Moves: dukung /moves dan /moves/:char */}
        <Route path="/moves" element={<Moves />} />
        <Route path="/moves/:char" element={<Moves />} />

        {/* Combo Maker: dukung /combo dan /combo/:char */}
        <Route path="/combo" element={<ComboMaker />} />
        <Route path="/combo/:char" element={<ComboMaker />} />

        {/* Kalkulator sederhana */}
        <Route path="/calculator" element={<Calculator />} />
      </Routes>
    </BrowserRouter>
  );
}