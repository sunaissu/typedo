import React from 'react';
import { createRoot } from 'react-dom/client';
import ProfilesApp from './ProfilesApp.jsx';
import './styles.css';
import './shell.css';
import './coach.css';
import './experience.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><ProfilesApp /></React.StrictMode>);
