import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root saknas');
createRoot(root).render(<App />);
