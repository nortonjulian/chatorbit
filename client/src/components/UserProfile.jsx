import { useState } from 'react';
import LanguageSelector from './LanguageSelector';
import axios from 'axios'

function UserProfile({ currentUser, onLanguageChange }) {
    const [preferredLanguage, setPreferredLanguage] = useState(currentUser.preferredLanguage || 'en')

    const saveLanguage = async () => {
        try {
            await axios.patch(`/api/users/${currentUser.id}`, { preferredLanguage })
            onLanguageChange(preferredLanguage)
            alert('Language preference saved!')
        } catch (error) {
            console.log('Failed to save language preference', error)
            alert('Error saving language preference')
        }
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            <label className="block mb-2">Preferred Language</label>
            <LanguageSelector currentLanguage={preferredLanguage} onChange={setPreferredLanguage}/>.
            <button
              onClick={saveLanguage}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
            >
                Save
            </button>
        </div>
    )
}

export default UserProfile