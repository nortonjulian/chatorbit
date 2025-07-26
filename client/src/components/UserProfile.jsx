import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import axios from 'axios'

function UserProfile({ currentUser, onLanguageChange }) {
    const [preferredLanguage, setPreferredLanguage] = useState(currentUser.preferredLanguage || 'en')
    const [showOriginalWithTranslation, setShowOriginalWithTranslation] = useState(currentUser.showOriginalWithTranslation ?? true)
    const [filterExplicitContent, setFilterExplicitContent] = useState(currentUser.allowExplicitContent ?? true)

    const saveSettings = async () => {
        try {
            await axios.patch(`/api/users/${currentUser.id}`, { 
                preferredLanguage,
                showOriginalWithTranslation,
                allowExplicitContent: !filterExplicitContent,
             })
            onLanguageChange(preferredLanguage)
            alert('Language preference saved!')
        } catch (error) {
            console.log('Failed to save settings', error)
            alert('Error saving settings')
        }
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            <label className="block mb-2">Preferred Language</label>
            <LanguageSelector 
                currentLanguage={preferredLanguage} 
                onChange={setPreferredLanguage}
            />

            <div className="mt-4">
                <label className="block mb-2">
                    <input
                       type="text"
                       className="mr-2"
                       checked={showOriginalWithTranslation}
                       onChange={(e) => setShowOriginalWithTranslation(e.target.checked)}
                    />
                    Show Original & Translated Messages
                </label>

                <label className="block">
                    <input
                       type="checkbox"
                       className="mr-2"
                       checked={filterExplicitContent}
                       onChange={(e) => setFilterExplicitContent(!e.target.checked)}
                    />
                    Filter 
                </label>
            </div>

            <button
              onClick={saveSettings}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
            >
                Save
            </button>
        </div>
    )
}

export default UserProfile