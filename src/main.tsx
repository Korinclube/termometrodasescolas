import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const dispatchGmpQuotaError = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

(window as Window & {gm_authFailure?: () => void}).gm_authFailure = dispatchGmpQuotaError;

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    args.some(
      (arg) =>
        typeof arg === 'string' &&
        (arg.includes('OverQuotaMapError') || arg.includes('QuotaExceededError'))
    )
  ) {
    dispatchGmpQuotaError();
  }
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);
