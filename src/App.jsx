import { useState, useEffect } from 'react'
import { collection, addDoc, query, where, getDocs, orderBy, doc, setDoc, getDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import emailjs from '@emailjs/browser';
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [lastCreatedCardId, setLastCreatedCardId] = useState('');
  const [viewingCard, setViewingCard] = useState(null);
  const [fontFamily, setFontFamily] = useState("'Caveat', cursive");
  const [bgStyle, setBgStyle] = useState({ type: 'color', value: '#fff' });

  // Chat State
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatTarget, setChatTarget] = useState(null); // The user we are chatting with

  useEffect(() => {
    // Check for invite link
    const params = new URLSearchParams(window.location.search);
    const connectId = params.get('connect');
    const cardId = params.get('card');

    if (connectId) {
      setManualId(connectId);
      // Remove param from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
      alert(`Bạn đã nhận được lời mời kết bạn từ ID: ${connectId}.\nID đã được điền sẵn vào ô gửi thiệp!`);
    }

    if (cardId) {
      fetchPublicCard(cardId);
    }

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

  const handleInvite = async () => {
    if (!inviteEmail) return alert("Vui lòng nhập email!");
    setIsSaving(true);

    // --- CẤU HÌNH EMAILJS (MIỄN PHÍ - CLIENT SIDE) ---
    const SERVICE_ID = 'service_l37a004';
    const TEMPLATE_ID = 'template_qvd919y';
    const PUBLIC_KEY = '356CAd-rAYM_Y4STI';

    const connectLink = `${window.location.origin}/?connect=${user?.uid}`;

    const templateParams = {
      to_email: inviteEmail,
      from_name: user?.displayName || "Bạn của bạn",
      message: `Chào bạn, mình muốn kết bạn để gửi thiệp Giáng Sinh! Bấm vào link này để chấp nhận và gửi lại thiệp cho mình nhé: ${connectLink}`,
      link: connectLink,
      my_id: user?.uid
    };

    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
      alert(`Đã gửi mail mời đến ${inviteEmail} thành công!`);
      setInviteEmail('');
      setShowInvite(false);
    } catch (e) {
      console.error("Lỗi gửi mail invite:", e);
      alert("Lỗi khi gửi mail: " + JSON.stringify(e));
    } finally {
      setIsSaving(false);
    }
  }

  const saveUserProfile = async (user) => {
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName,
        email: user.email,
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

  const fetchPublicCard = async (cardId) => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "christmas-cards", cardId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setViewingCard({ id: docSnap.id, ...docSnap.data() });
        setMode('view_card');
      } else {
        alert("Không tìm thấy thiệp này!");
      }
    } catch (e) {
      console.error("Lỗi tải thiệp:", e);
      alert("Lỗi khi tải thiệp: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- CHAT LOGIC ---

  useEffect(() => {
    if (!activeChatId) return;

    const q = query(
      collection(db, "chats", activeChatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatMessages(msgs);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const getChatId = (uid1, uid2) => {
    return [uid1, uid2].sort().join("_");
  }

  const handleSelectChatRef = (targetUser) => {
    if (!user) return alert("Vui lòng đăng nhập để chat!");
    const chatId = getChatId(user.uid, targetUser.id);
    setActiveChatId(chatId);
    setChatTarget(targetUser);
    setMode('chat');
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeChatId || !user) return;

    const text = chatInput.trim();
    setChatInput(''); // Clear input immediately for UX

    try {
      // 1. Add message to subcollection
      await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        senderName: user.displayName
      });

      // 2. Update chat metadata (for recent chats list - optional feature for future)
      await setDoc(doc(db, "chats", activeChatId), {
        users: [user.uid, chatTarget.id],
        lastMessage: text,
        updatedAt: serverTimestamp()
      }, { merge: true });

    } catch (e) {
      console.error("Error sending message:", e);
      alert("Lỗi gửi tin nhắn");
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
    if (stamps.length >= 12) return alert("Hết chỗ dán rồi bạn ơi!");
    setStamps([...stamps, { id: Date.now() + Math.random(), char: stamp, x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 }])
  }

  const handleRemoveStamp = (id) => {
    setStamps(stamps.filter(s => s.id !== id))
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
      let recipientEmail = null;
      let targetId = manualId.trim() || selectedFriend;

      if (targetId) {
        let friend = null;

        // CHECK IF INPUT IS EMAIL
        if (targetId.includes('@')) {
          recipientEmail = targetId;
          // 1. Try finding in loaded list
          friend = users.find(u => u.email === targetId);

          // 2. If not, query Firestore
          if (!friend) {
            const q = query(collection(db, "users"), where("email", "==", targetId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const docData = snap.docs[0];
              friend = { id: docData.id, ...docData.data() };
            }
          }
        } else {
          // INPUT IS ID
          friend = users.find(u => u.id === targetId);
          if (!friend && manualId.trim()) {
            try {
              const userDoc = await getDoc(doc(db, "users", targetId));
              if (userDoc.exists()) friend = { id: userDoc.id, ...userDoc.data() };
            } catch (err) { console.warn("Verify ID failed"); }
          }
        }

        if (friend) {
          recipientInfo = {
            id: friend.id,
            name: friend.displayName || "Bạn",
            photo: friend.photoURL,
            email: friend.email
          };
          if (!recipientEmail && friend.email) recipientEmail = friend.email;
        } else if (targetId && targetId.includes('@')) {
          recipientInfo = {
            id: 'guest',
            name: targetId,
            email: targetId,
            photo: null
          };
        } else if (manualId.trim()) {
          recipientInfo = {
            id: manualId.trim(),
            name: "ID: " + manualId.trim().substring(0, 4) + "...",
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
        recipient: recipientInfo,
        fontFamily: fontFamily,
        bgStyle: bgStyle
      };

      const docRef = await addDoc(collection(db, "christmas-cards"), cardData);
      setLastCreatedCardId(docRef.id);

      // --- SEND EMAIL NOTIFICATION VIA EMAILJS ---
      if (recipientEmail) {
        const SERVICE_ID = 'service_l37a004';
        const TEMPLATE_ID = 'template_qvd919y';
        const PUBLIC_KEY = '356CAd-rAYM_Y4STI';

        const emailParams = {
          to_email: recipientEmail,
          from_name: currentUser?.displayName || "Một người bạn",
          message: `Bạn nhận được một thiệp Giáng Sinh!\n\n"${message}"\n\nXem tại: ${window.location.origin}/?card=${docRef.id}`,
          link: `${window.location.origin}/?card=${docRef.id}`,
          my_id: currentUser?.uid
        };

        emailjs.send(SERVICE_ID, TEMPLATE_ID, emailParams, PUBLIC_KEY)
          .then(() => console.log("Email Notification Sent"))
          .catch(err => console.error("Email Notification Failed", err));
      }

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
    setFontFamily("'Caveat', cursive")
    setBgStyle({ type: 'color', value: '#fff' })
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
              <span className="invite-link" onClick={() => setShowInvite(!showInvite)}>Mời bạn bè 📧</span>
            </div>
            <button className="pixel-btn sm-btn" onClick={() => setMode('chat')}>Tin Nhắn 💬</button>
            <button className="pixel-btn sm-btn" onClick={() => setMode('list')}>Hộp Thư 📬</button>
            <button className="pixel-btn sm-btn logout" onClick={handleLogout}>Đăng Xuất</button>
          </div>
        ) : (
          <button className="pixel-btn sm-btn login" onClick={handleLogin}>
            Đăng nhập Google
          </button>
        )}
      </div>

      {showInvite && (
        <div className="invite-popup">
          <input
            type="email"
            className="pixel-input sm-input"
            placeholder="Nhập Gmail bạn bè..."
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button disabled={isSaving} className="pixel-btn sm-btn" onClick={handleInvite}>
            {isSaving ? "Đang gửi..." : "Gửi Gmail Mời 📨"}
          </button>
          <button className="close-btn" onClick={() => setShowInvite(false)}>✕</button>
        </div>
      )}

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

              <div className="style-section">
                <label>Phông chữ:</label>
                <div className="font-options">
                  {[
                    { name: 'Nét viết', value: "'Caveat', cursive" },
                    { name: 'Mềm mại', value: "'Dancing Script', cursive" },
                    { name: 'Vui nhộn', value: "'Mountains of Christmas', cursive" },
                    { name: 'Nghệ thuật', value: "'Pacifico', cursive" }
                  ].map(f => (
                    <button
                      key={f.value}
                      className={`font-btn ${fontFamily === f.value ? 'active' : ''}`}
                      style={{ fontFamily: f.value }}
                      onClick={() => setFontFamily(f.value)}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-section">
                <label>Màu nền / Hiệu ứng:</label>
                <div className="bg-options">
                  {[
                    { type: 'color', value: '#fff' },
                    { type: 'color', value: '#ffcccc' },
                    { type: 'color', value: '#ccffcc' },
                    { type: 'color', value: '#fff5cc' },
                    { type: 'gradient', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', label: '🌸' },
                    { type: 'gradient', value: 'linear-gradient(to top, #11998e, #38ef7d)', label: '🌿' },
                    { type: 'gradient', value: 'linear-gradient(to bottom, #d42426, #7e0c0e)', label: '🍎' },
                    { type: 'gradient', value: 'linear-gradient(to bottom, #0f2027, #2c5364)', label: '🌌' }
                  ].map((b, i) => (
                    <button
                      key={i}
                      className={`bg-btn ${bgStyle.value === b.value ? 'active' : ''}`}
                      style={{ background: b.value }}
                      onClick={() => setBgStyle(b)}
                    >
                      {b.label || ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="style-section">
                <label>Hình dán (Click để thêm, click vào hình trong thiệp để xóa):</label>
                <div className="stamp-options">
                  {['🎄', '🎅', '⛄', '🎁', '⭐', '🔔', '❄️', '🦌', '🍬', '🍪', '🧦', '🕯️'].map(s => (
                    <button key={s} className="stamp-btn" onClick={() => handleAddStamp(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="card-preview"
              style={{
                background: bgStyle.value,
                fontFamily: fontFamily
              }}
            >
              <p className="card-text">{message || "Lời chúc của bạn..."}</p>
              <div className="card-stamps-layer">
                {stamps.map((s) => (
                  <span
                    key={s.id}
                    className="placed-stamp"
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    onClick={() => handleRemoveStamp(s.id)}
                    title="Click để xóa"
                  >
                    {s.char}
                  </span>
                ))}
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
            <div
              className="final-card"
              style={{
                background: bgStyle.value,
                fontFamily: fontFamily
              }}
            >
              <p className="card-text">{message}</p>
              <div className="card-stamps-layer">
                {stamps.map((s) => (
                  <span
                    key={s.id}
                    className="placed-stamp"
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  >
                    {s.char}
                  </span>
                ))}
              </div>
            </div>

            <div className="share-section">
              <p>Chia sẻ link để người nhận xem trực tiếp:</p>
              <div className="share-link-box">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?card=${lastCreatedCardId}`}
                  className="pixel-input sm-input"
                />
                <button
                  className="pixel-btn sm-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?card=${lastCreatedCardId}`);
                    alert("Đã sao chép link chia sẻ!");
                  }}
                >
                  Sao chép 📋
                </button>
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
                  <div key={card.id} className="mini-card" style={{ background: card.bgStyle?.value || card.color, fontFamily: card.fontFamily || 'inherit' }}>
                    <p className="mini-msg">{card.message}</p>
                    <div className="mini-stamps">
                      {card.stamps && card.stamps.slice(0, 3).map((s) => <span key={s.id || Math.random()}>{s.char || s}</span>)}
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

        {mode === 'chat' && (
          <div className="chat-container-layout">
            <div className="chat-sidebar">
              <h3>Danh Sách Bạn Bè</h3>
              <div className="friends-list">
                {users.map(u => (
                  <div
                    key={u.id}
                    className={`friend-item ${chatTarget?.id === u.id ? 'active' : ''}`}
                    onClick={() => handleSelectChatRef(u)}
                  >
                    <img src={u.photoURL || "https://ui-avatars.com/api/?name=User"} alt="avt" className="mini-avatar" />
                    <span>{u.displayName || "Noname"}</span>
                    {u.id === user?.uid && "(Bạn)"}
                  </div>
                ))}
              </div>
              <button className="pixel-btn sm-btn" onClick={() => setMode('initial')} style={{ marginTop: 'auto' }}>Thoát</button>
            </div>

            <div className="chat-main">
              {chatTarget ? (
                <>
                  <div className="chat-header">
                    <img src={chatTarget.photoURL} alt="" className="mini-avatar" />
                    <span>Đang chat với: <strong>{chatTarget.displayName}</strong></span>
                  </div>
                  <div className="chat-messages">
                    {chatMessages.length === 0 ? (
                      <div className="empty-chat">Chưa có tin nhắn nào. Hãy nói "Xin chào"! 👋</div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className={`message-bubble ${msg.senderId === user.uid ? 'me' : 'them'}`}>
                          <div className="msg-content">{msg.text}</div>
                          {/* <div className="msg-time">{msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString() : '...'}</div> */}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="chat-input-area">
                    <input
                      type="text"
                      className="pixel-input sm-input chat-input-field"
                      placeholder="Nhập tin nhắn..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button className="pixel-btn sm-btn" onClick={handleSendMessage}>Gửi ✈️</button>
                  </div>
                </>
              ) : (
                <div className="no-chat-selected">
                  <p>⬅ Chọn một người bạn để bắt đầu trò chuyện</p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'view_card' && viewingCard && (
          <div className="view-card-mode">
            <h2>Bạn nhận được một lời chúc!</h2>
            <div className="card-author-info">
              {viewingCard.photoURL && <img src={viewingCard.photoURL} alt="avt" className="user-avatar" />}
              <p>Từ: <strong>{viewingCard.authorName}</strong></p>
            </div>
            <div
              className="final-card"
              style={{
                background: viewingCard.bgStyle?.value || viewingCard.color,
                fontFamily: viewingCard.fontFamily || "'Caveat', cursive"
              }}
            >
              <p className="card-text">{viewingCard.message}</p>
              <div className="card-stamps-layer">
                {viewingCard.stamps && viewingCard.stamps.map((s) => (
                  <span
                    key={s.id || Math.random()}
                    className="placed-stamp"
                    style={{ left: `${s.x || 50}%`, top: `${s.y || 50}%` }}
                  >
                    {s.char || s}
                  </span>
                ))}
              </div>
            </div>
            <div className="view-card-actions">
              <button className="pixel-btn" onClick={() => {
                setMode('initial');
                window.history.replaceState({}, document.title, window.location.pathname);
              }}>
                Tạo thiệp của riêng bạn 🎄
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default App
