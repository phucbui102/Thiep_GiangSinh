import { useState, useEffect } from 'react'
import { collection, addDoc, query, where, getDocs, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db, auth, googleProvider } from './firebase';
import './App.css'

function App() {
  const [mode, setMode] = useState('initial') // initial, decorating, sent, list
  const [message, setMessage] = useState('')
  const [cardColor, setCardColor] = useState('#fff')
  const [stamps, setStamps] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [receivedCards, setReceivedCards] = useState([]);
  const [listTab, setListTab] = useState('received'); // 'received' | 'sent'
  const [users, setUsers] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [manualId, setManualId] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        await saveUserProfile(currentUser);
        fetchMyCards(currentUser.uid);
        fetchReceivedCards(currentUser.uid);
        fetchUsers(currentUser.uid);
      } else {
        setMyCards([]);
        setReceivedCards([]);
        setUsers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveUserProfile = async (user) => {
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastSeen: new Date()
      }, { merge: true });
    } catch (e) {
      console.error("Error saving user profile:", e);
    }
  }

  const fetchUsers = async (currentUid) => {
    try {
      const q = query(collection(db, "users"));
      const querySnapshot = await getDocs(q);
      const userList = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== currentUid);
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMyCards = async (uid) => {
    try {
      const q = query(
        collection(db, "christmas-cards"),
        where("uid", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      const cards = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setMyCards(cards);
    } catch (error) {
      console.error("Lỗi lấy danh sách thiệp:", error);
    }
  };

  const fetchReceivedCards = async (uid) => {
    try {
      const q = query(
        collection(db, "christmas-cards"),
        where("recipient.id", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      const cards = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setReceivedCards(cards);
    } catch (error) {
      console.error("Lỗi lấy thiệp được nhận:", error);
      alert("Lỗi tải hộp thư (có thể do thiếu Index, đã chuyển sang sort client): " + error.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Đăng nhập thất bại: " + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMode('initial');
  };

  const handleStart = () => {
    if (!user && users.length === 0) {
      fetchUsers('anonymous');
    }
    setMode('decorating');
  }

  const handleAddStamp = (stamp) => {
    setStamps([...stamps, stamp])
  }

  const handleCopyId = () => {
    if (user) {
      navigator.clipboard.writeText(user.uid);
      alert("Đã sao chép ID của bạn: " + user.uid);
    }
  }

  const handleSend = async () => {
    if (!message) return alert("Hãy viết lời chúc nhé!")

    setIsSaving(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        try {
          const result = await signInAnonymously(auth);
          currentUser = result.user;
        } catch (authError) {
          console.warn("Auth error ignored:", authError);
        }
      }

      let recipientInfo = null;
      let targetId = manualId.trim() || selectedFriend;

      if (targetId) {
        let friend = users.find(u => u.id === targetId);

        if (!friend && manualId.trim()) {
          try {
            const userDoc = await getDoc(doc(db, "users", targetId));
            if (userDoc.exists()) {
              friend = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (err) {
            console.warn("Could not verify manual ID recipient");
          }
        }

        if (friend) {
          recipientInfo = {
            id: friend.id,
            name: friend.displayName || "Bạn",
            photo: friend.photoURL
          };
        } else if (manualId.trim()) {
          recipientInfo = {
            id: manualId.trim(),
            name: "Người dùng (ID: " + manualId.trim().substring(0, 4) + "...",
            photo: null
          };
        }
      }

      const cardData = {
        message: message,
        color: cardColor,
        stamps: stamps,
        createdAt: new Date(),
        uid: currentUser ? currentUser.uid : 'anonymous',
        authorName: currentUser ? (currentUser.displayName || 'Ẩn danh') : 'Ẩn danh',
        photoURL: currentUser ? currentUser.photoURL : null,
        recipient: recipientInfo
      };

      await addDoc(collection(db, "christmas-cards"), cardData);

      if (currentUser) {
        fetchMyCards(currentUser.uid);
      }
      setMode('sent');
      setManualId('');
      setSelectedFriend('');
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("Lỗi khi gửi thiệp: " + e.message);
    } finally {
      setIsSaving(false);
    }
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

      <div className="auth-bar">
        {user ? (
          <div className="user-info">
            <img src={user.photoURL || "https://ui-avatars.com/api/?name=User"} alt="Avatar" className="user-avatar" />
            <div className="user-details">
              <span className="user-name">Xin chào, {user.displayName || "Bạn"}!</span>
              <span className="user-id-label" onClick={handleCopyId} title="Click để sao chép">ID: {user.uid.substring(0, 6)}... 📋</span>
            </div>
            <button className="pixel-btn sm-btn" onClick={() => setMode('list')}>Hộp Thư 📬</button>
            <button className="pixel-btn sm-btn logout" onClick={handleLogout}>Đăng Xuất</button>
          </div>
        ) : (
          <button className="pixel-btn sm-btn login" onClick={handleLogin}>
            Đăng nhập Google
          </button>
        )}
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
              {user && (
                <div className="recipient-selector">
                  <label>Gửi đến:</label>
                  <div className="recipient-inputs">
                    {users.length > 0 && (
                      <select
                        className="pixel-select"
                        value={selectedFriend}
                        onChange={(e) => {
                          setSelectedFriend(e.target.value);
                          setManualId('');
                        }}
                      >
                        <option value="">-- Chọn bạn bè --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.displayName || "Người dùng ẩn danh"}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      className="pixel-input sm-input"
                      placeholder="Hoặc nhập ID người nhận..."
                      value={manualId}
                      onChange={(e) => {
                        setManualId(e.target.value);
                        setSelectedFriend('');
                      }}
                    />
                  </div>
                </div>
              )}

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

            <div className="btn-group">
              <button className="pixel-btn" onClick={() => setMode('initial')}>Quay lại</button>
              <button className="pixel-btn send-btn" onClick={handleSend} disabled={isSaving}>
                {isSaving ? 'Đang Gửi...' : 'Gửi Thiệp 🚀'}
              </button>
            </div>
          </div>
        )}

        {mode === 'sent' && (
          <div className="sent-notification">
            <h2>Đã Gửi Thành Công!</h2>
            {selectedFriend && (
              <p className="sent-to-label">Đã gửi đến: <strong>{users.find(u => u.id === selectedFriend)?.displayName}</strong></p>
            )}
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

        {mode === 'list' && (
          <div className="my-cards-list">
            <h2>Hộp Thư Giáng Sinh</h2>
            <div className="tabs">
              <button
                className={`tab-btn ${listTab === 'received' ? 'active' : ''}`}
                onClick={() => setListTab('received')}
              >
                Đã Nhận ({receivedCards.length})
              </button>
              <button
                className={`tab-btn ${listTab === 'sent' ? 'active' : ''}`}
                onClick={() => setListTab('sent')}
              >
                Đã Gửi ({myCards.length})
              </button>
            </div>

            <div className="cards-grid">
              {(listTab === 'received' ? receivedCards : myCards).length === 0 ? (
                <p style={{ color: '#fff', width: '100%' }}>Chưa có tấm thiệp nào.</p>
              ) : (
                (listTab === 'received' ? receivedCards : myCards).map(card => (
                  <div key={card.id} className="mini-card" style={{ backgroundColor: card.color }}>
                    <p className="mini-msg">{card.message}</p>
                    <div className="mini-stamps">
                      {card.stamps && card.stamps.slice(0, 3).map((s, i) => <span key={i}>{s}</span>)}
                    </div>
                    <div className="card-footer">
                      <span className="card-author">
                        {listTab === 'received' ? `Từ: ${card.authorName}` : `Đến: ${card.recipient ? card.recipient.name : 'Mọi người'}`}
                      </span>
                      <span className="card-date">
                        {card.createdAt?.seconds ? new Date(card.createdAt.seconds * 1000).toLocaleDateString() : 'Vừa xong'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="pixel-btn" onClick={() => setMode('initial')} style={{ marginTop: '20px' }}>
              Quay Lại
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default App
