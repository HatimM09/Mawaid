const fs = require('fs');
let c = fs.readFileSync('src/App.jsx', 'utf8');

// Find the "contact an admin" text
const contactIdx = c.indexOf('contact an admin');
if (contactIdx === -1) {
  console.log('Contact admin text not found - checking what is in the file...');
  // Search for nearby text
  const searchTerms = ['To update your profile', 'Edit Profile', 'handleSaveProfile'];
  for (const term of searchTerms) {
    const idx = c.indexOf(term);
    if (idx > -1) console.log('Found "' + term + '" at position', idx);
    else console.log('"' + term + '" not found');
  }
  process.exit(0);
}

// Find the start of the contact admin div
const divStart = c.lastIndexOf('<div', contactIdx);
if (divStart === -1) {
  console.log('Could not find div start');
  process.exit(0);
}

// Find the closing </div> after contact admin
const divEnd = c.indexOf('</div>', contactIdx);
if (divEnd === -1) {
  console.log('Could not find div end');
  process.exit(0);
}

const oldDiv = c.substring(divStart, divEnd + 6);
console.log('Found contact admin div. Length:', oldDiv.length);
console.log('First 60 chars:', oldDiv.substring(0, 60));

// The new content to replace it with
const editBtnAndForm = `        <Btn onClick={() => setEditing(true)} style={{ marginTop: 14, borderRadius: 12, fontSize: 13, padding: '12px 20px' }}>
          <Edit2 size={14} /> Edit Profile
        </Btn>
      </Card>

      {editing && (
        <Card active style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.accent, fontFamily: "'Playfair Display',serif" }}>Edit Profile</h3>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: t.textSub, cursor: 'pointer', padding: 4 }}><X size={20} /></button>
          </div>
          {saveSuccess && <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: t.successBg, border: '1px solid ' + t.successBorder + ', color: t.successText, fontSize: 13, fontWeight: 600, textAlign: 'center', fontFamily: "'DM Sans',sans-serif" }}>{saveSuccess}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>Full Name</label>
              <input name="editName" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Your name" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box', background: t.inputBg, border: '1px solid ' + t.inputBorder + ', color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>Phone Number</label>
              <input name="editPhone" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="+91 98765 43210" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box', background: t.inputBg, border: '1px solid ' + t.inputBorder + ', color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>Residential Address</label>
              <textarea name="editAddress" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} placeholder="Your address" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box', background: t.inputBg, border: '1px solid ' + t.inputBorder + ', color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif", resize: 'vertical', minHeight: 70 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: t.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>Avatar URL</label>
              <input name="editAvatar" value={editForm.avatar_url} onChange={e => setEditForm({...editForm, avatar_url: e.target.value})} placeholder="https://example.com/avatar.jpg" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box', background: t.inputBg, border: '1px solid ' + t.inputBorder + ', color: t.text, fontSize: 14, outline: 'none', fontFamily: "'DM Sans',sans-serif" }} />
              {editForm.avatar_url && (
                <div style={{ marginTop: 8, width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid ' + t.accentBorder + ' }}>
                  <img src={editForm.avatar_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid ' + t.border + ', background: 'transparent', color: t.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            <button onClick={handleSaveProfile} disabled={saving} style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: saving ? t.border : t.accentGrad, color: '#000', fontSize: 14, fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif", boxShadow: '0 4px 15px ' + t.accentBg + ', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </Card>
      )}
      <SectionLabel>My Activity</SectionLabel>`;

c = c.replace(oldDiv, editBtnAndForm);

// Now add Delete My Account button before the logout button
const logoutSection = '<LogOut size={20}';
const accSectionEnd = c.indexOf('<SectionLabel>Account</SectionLabel>', c.indexOf('function ProfileMainPage'));
if (accSectionEnd > -1) {
  // Find where the logout button ends (find the </button> after LogOut)
  const logoutBtnStart = c.indexOf(logoutSection, accSectionEnd);
  const logoutBtnEnd = c.indexOf('</button>', logoutBtnStart);
  
  if (logoutBtnStart > -1 && logoutBtnEnd > -1) {
    const deleteAccountUI = `        <SectionLabel>Account</SectionLabel>
        
        {/* Delete Account */}
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} style={{ width: '100%', padding: '14px', borderRadius: 16, border: '1px solid rgba(224,85,85,0.3)', background: 'rgba(224,85,85,0.06)', color: '#e05555', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s' }}>
            <Trash2 size={16} /> Delete My Account
          </button>
        ) : (
          <div style={{ padding: 16, borderRadius: 14, background: 'rgba(224,85,85,0.06)', border: '1px solid rgba(224,85,85,0.3)', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e05555', marginBottom: 12, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
              ⚠️ Are you sure you want to permanently delete your account? This action cannot be undone. All your data including survey responses, requests, and queries will be removed.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(false)} disabled={deleting} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid ' + t.border + ', background: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: deleting ? '#999' : '#e05555', color: '#fff', fontSize: 13, fontWeight: 900, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{deleting ? 'Deleting...' : 'Yes, Delete My Account'}</button>
            </div>
          </div>
        )}
        
        `;
    
    // Replace "SectionLabel>Account</SectionLabel>" + logout button with
    // delete account UI + logout button
    const oldAccSection = c.substring(accSectionEnd, logoutBtnEnd + 9);
    c = c.replace(oldAccSection, deleteAccountUI + oldAccSection);
  }
}

fs.writeFileSync('src/App.jsx', c, 'utf8');
console.log('File updated successfully!');
