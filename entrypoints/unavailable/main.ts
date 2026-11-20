import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import { failureMessages } from '../../src/core/protocol';
import './popup.css';

const reason = new URLSearchParams(location.search).get('reason');
const { title, message } = reason === 'file' || reason === 'injection' ? failureMessages[reason] : failureMessages.restricted;

document.getElementById('notice-title')!.textContent = title;
document.getElementById('notice-description')!.textContent = message;
document.getElementById('dismiss')!.addEventListener('click', () => window.close());
