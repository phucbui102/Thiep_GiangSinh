import { useState } from 'react'
import './App.css'

function App() {
  const [mode, setMode] = useState('initial') // initial, decorating, sent
  const [message, setMessage] = useState('')
  const [cardColor, setCardColor] = useState('#fff')
  const [stamps, setStamps] = useState([])

  const handleStart = () => setMode('decorating')

  const handleAddStamp = (stamp) => {
    setStamps([...stamps, stamp])
  }

  const handleSend = () => {
    if (!message) return alert("Hãy viết lời chúc nhé!")
    setMode('sent')
  }

  const handleReset = () => {
    setMode('initial')
    setMessage('')
    setStamps([])
    setCardColor('#fff')
  }

  return (
    <>
      <div className="snow-container">
        {[...Array(15)].map((_, i) => (
          <div key={i} className="snowflake"></div>
        ))}
      </div>

      <div className="christmas-container">
        <h1 className="hero-title">Merry Christmas</h1>

        {mode === 'initial' && (
          <>
            <p className="subtitle">GIÁNG SINH AN LÀNH</p>
            <button className="pixel-btn start-btn" onClick={handleStart}>
              Gửi Lời Chúc ✉️
            </button>
          </>
        )}

        {mode === 'decorating' && (
          <div className="card-editor">
            <h2>Trang Trí Thiệp</h2>

            <div className="editor-controls">
              <textarea
                className="pixel-input"
                placeholder="Nhập lời chúc của bạn..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <div className="color-options">
                {['#fff', '#ffcccc', '#ccffcc', '#fff5cc'].map(c => (
                  <button
                    key={c}
                    className={`color-btn ${cardColor === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setCardColor(c)}
                  />
                ))}
              </div>

              <div className="stamp-options">
                {['🎄', '🎅', '⛄', '🎁', '⭐'].map(s => (
                  <button key={s} className="stamp-btn" onClick={() => handleAddStamp(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="card-preview" style={{ backgroundColor: cardColor }}>
              <p className="card-text">{message || "Lời chúc của bạn..."}</p>
              <div className="card-stamps">
                {stamps.map((s, i) => <span key={i}>{s}</span>)}
              </div>
            </div>

            <button className="pixel-btn send-btn" onClick={handleSend}>
              Gửi Thiệp 🚀
            </button>
          </div>
        )}

        {mode === 'sent' && (
          <div className="sent-notification">
            <h2>Đã Gửi Thành Công!</h2>
            <div className="final-card" style={{ backgroundColor: cardColor }}>
              <p>{message}</p>
              <div className="final-stamps">
                {stamps.map((s, i) => <span key={i}>{s}</span>)}
              </div>
            </div>
            <button className="pixel-btn reset-btn" onClick={handleReset}>
              Làm Thiệp Khác ↺
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default App
