import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import axiosClient from '../api/axiosClient';
import { useUser } from '../context/useUser';

function UserProfile({ onLanguageChange }) {
    const { currentUser, setCurrentUser } = useUser();

    const [preferredLanguage, setPreferredLanguage] = useState(currentUser.preferredLanguage || 'en')
    const [showOriginalWithTranslation, setShowOriginalWithTranslation] = useState(currentUser.showOriginalWithTranslation ?? true)
    const [allowExplicitContent, setAllowExplicitContent] = useState(currentUser.allowExplicitContent ?? true)  // if false or undefined, treat as true 
    const [enableAIResponder, setEnableAIResponder] = useState(currentUser.enableAIResponder ?? false);
    const [enableReadReceipts, setEnableReadReceipts] = useState(currentUser.enableReadReceipts ?? false);
    const [autoDeleteSeconds, setAutoDeleteSeconds] = useState(currentUser.autoDeleteSeconds || 0);
    const [statusMessage, setStatusMessage] = useState('')
      
    const saveSettings = async () => {
        try {
            await axiosClient.patch(`/users/${currentUser.id}`, { 
                preferredLanguage,
                showOriginalWithTranslation,
                allowExplicitContent,
                enableAIResponder,
                enableReadReceipts,
                autoDeleteSeconds: parseInt(autoDeleteSeconds)
             })
            onLanguageChange(preferredLanguage)
            alert('Language preference saved!')
        } catch (error) {
            console.log('Failed to save settings', error)
            setStatusMessage('Error: Could not save settings')
        }
    }

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const res = await fetch('http://localhost:5001/users/avatar', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
            });

            const data = await res.json();
            if (data.avatarUrl) {
            setCurrentUser((prev) => ({ ...prev, avatarUrl: data.avatarUrl })); // ✅ update global context
            setStatusMessage('Avatar uploaded!');
            }
        } catch (err) {
            console.error('Avatar upload failed', err);
            setStatusMessage('Failed to upload avatar');
        }
      };
      

    return (
        <div className="p-4 max-w-md mx-auto bg-white rounded shadow">
            <div className="mb-4">
                <label className="block font-medium mb-1">Profile Picture</label>
                {currentUser.avatarUrl && (
                <img
                    src={currentUser.avatarUrl || '/default-avatar.png'}
                    alt="Profile avatar"
                    className="w-16 h-16 rounded-full object-cover mb-2"
                />
                )}

                <input type="file" accept="image/*" onChange={handleAvatarUpload} />
            </div>

            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            <label className="block mb-2">Preferred Language</label>
            <LanguageSelector 
                currentLanguage={preferredLanguage} 
                onChange={setPreferredLanguage}
            />

            <div className="mt-4 space-y-2">
                <label className="flex items-center space-x-2">
                    <input
                       type="checkbox"
                       checked={showOriginalWithTranslation}
                       onChange={(e) => setShowOriginalWithTranslation(e.target.checked)}
                    />
                    Show Original & Translated Messages
                </label>

                <label className="block">
                    <input
                       type="checkbox"
                       checked={!allowExplicitContent}
                       onChange={(e) => setAllowExplicitContent(!e.target.checked)}
                    />
                    Filter 
                </label>

                <label className="block mt-4">
                <input
                    type="checkbox"
                    checked={enableAIResponder}
                    onChange={(e) => setEnableAIResponder(e.target.checked)}
                    className="mr-2"
                />
                 AI reply
                </label>

                <label className="flex items-center space-x-2">
                    <input
                       type="checkbox"
                       checked={enableReadReceipts}
                       onChange={(e) => setEnableReadReceipts(e.target.checked)}
                    />
                    Enable Read Receipts
                </label>
                <label className="block mt-4">
                <span className="flex items-center space-x-2 mb-1">
                    <input
                    type="checkbox"
                    checked={autoDeleteSeconds > 0}
                    onChange={(e) => setAutoDeleteSeconds(e.target.checked ? 10 : 0)} // default to 10 sec
                    />
                    <span>Enable Disappearing Messages</span>
                </span>

                {autoDeleteSeconds > 0 && (
                    <input
                    type="number"
                    value={autoDeleteSeconds}
                    onChange={(e) => setAutoDeleteSeconds(Number(e.target.value))}
                    className="w-full px-2 py-1 border rounded"
                    min="1"
                    placeholder="Seconds until auto-delete"
                    />
                )}
                </label>
            </div>

            <button
              onClick={saveSettings}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded rounded hover:bg-blue-700"
            >
                Save
            </button>
            {statusMessage && <p className="mt-3 text-sm text-gray-600">{statusMessage}</p>}
        </div>
    )
}

export default UserProfile