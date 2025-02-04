const loadNotificationTemplate = (userData, loadData) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            font-family: Arial, sans-serif;
            color: #333;
        }
        .header {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-bottom: 3px solid #007bff;
        }
        .content {
            padding: 20px;
        }
        .load-details {
            background-color: #f8f9fa;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 15px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h2>New Load Alert</h2>
        </div>
        <div class="content">
            <p>Hello ${userData.name},</p>
            <p>A new load has been posted in your service area:</p>
            
            <div class="load-details">
                <p><strong>Job Number:</strong> ${loadData.jobNumber}</p>
                <p><strong>Pickup Location:</strong> ${loadData.pickupLocation}</p>
                <p><strong>Delivery Location:</strong> ${loadData.deliveryLocation}</p>
                <p><strong>Pickup Date:</strong> ${new Date(loadData.pickupDate).toLocaleDateString()}</p>
                <p><strong>Cubic Feet:</strong> ${loadData.cubicFeet}</p>
                <p><strong>Distance:</strong> ${loadData.details.distance} miles</p>
                <p><strong>Estimated Rate:</strong> $${loadData.rate}</p>
            </div>

            <a href="${process.env.FRONTEND_URL}/loads/${loadData.id}" class="button">View Load Details</a>
        </div>
        <div class="footer">
            <p>You're receiving this because you've enabled email notifications for loads in your service area.</p>
            <p>To update your notification preferences, visit your account settings.</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = loadNotificationTemplate; 