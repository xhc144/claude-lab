import React from 'react'
import { createRoot } from 'react-dom/client'
import Game from './game.jsx'
import Home from './home.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(window.location.pathname === '/game' ? <Game /> : <Home />)
