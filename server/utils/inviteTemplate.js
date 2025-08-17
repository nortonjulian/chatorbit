/**
 * Generate an invite email body for an event.
 * @param {Object} params
 * @param {string} params.eventName - The name of the event.
 * @param {string} params.eventDate - Formatted date string.
 * @param {string} params.eventTime - Formatted time string.
 * @param {string} params.location - Event location.
 * @param {string} params.hostName - Name of the host.
 * @param {string} params.joinLink - URL for joining the event.
 * @returns {string} Email HTML content.
 */
export function createInviteTemplate({
  eventName,
  eventDate,
  eventTime,
  location,
  hostName,
  joinLink,
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>You're Invited: ${eventName}</h2>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Time:</strong> ${eventTime}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Host:</strong> ${hostName}</p>
      <p>
        <a href="${joinLink}" style="color: #007BFF;">Join Event</a>
      </p>
    </div>
  `;
}
