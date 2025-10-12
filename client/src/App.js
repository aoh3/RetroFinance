import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Flippy from "./components/Flippy";
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/kms" element={<Flippy maxLen={10} />} />
      </Routes>
    </Router>
  );
}

export default App;