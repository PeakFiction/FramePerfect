import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import CharacterSelect from './pages/CharacterSelect.jsx';
import ComboMaker from './pages/ComboMaker.jsx';
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
        <Route path="/" element={<CharacterSelect />} />
        <Route path="/combo" element={<ComboMaker />} />
        <Route path="/calculator" element={<Calculator />} />
      </Routes>
    </BrowserRouter>
  );
}
