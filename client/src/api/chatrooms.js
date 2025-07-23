import axios from 'axios'

export const fetchChatrooms = async (userId) => {
    try {
        const res = await axios.get('/api/chatrooms', {
            params: { userId }
        });
        return res.data;
    } catch (error) {
        console.log('Error fetching chatrooms failed', error)
        return [];
    }
}

export const createGroupChatroom = async (userIds, chatName) => {
    try {
        const res = await axios.post('/api/chatrooms/group', { userIds, chatName })
        return res.data;
    } catch (error) {
        console.log('Error creating group chatroom:', error)
        throw error
    }
}

export const findOrCreateOneToOneChat = async (userId1, userId2) => {
    try {
        const res = await axios.post('/api/chatrooms/one-to-one', { userId1, userId2 })
        return res.data;
    } catch (error) {
        console.log('Error creating/finding one-to-one chat:', error)
        throw error
    }
}
