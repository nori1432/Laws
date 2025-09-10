from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime

contact_bp = Blueprint('contact', __name__)

# In-memory storage for contact messages (in production, use database)
contact_messages = []

@contact_bp.route('/submit', methods=['POST'])
def submit_contact():
    """Handle contact form submission"""
    try:
        data = request.get_json()

        required_fields = ['name', 'email', 'subject', 'message']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        # Store the message
        message_data = {
            'id': len(contact_messages) + 1,
            'name': data['name'],
            'email': data['email'],
            'subject': data['subject'],
            'message': data['message'],
            'created_at': datetime.utcnow().isoformat(),
            'status': 'unread'
        }

        contact_messages.append(message_data)

        # Send email notification to admin (optional)
        try:
            send_contact_notification_email(message_data)
        except Exception as e:
            print(f"Email notification failed: {e}")

        return jsonify({
            'message': 'Message sent successfully! We will get back to you soon.',
            'id': message_data['id']
        }), 200

    except Exception as e:
        print(f"Contact submission error: {e}")
        return jsonify({'error': 'Failed to send message'}), 500

@contact_bp.route('/messages', methods=['GET'])
@jwt_required()
def get_contact_messages():
    """Get all contact messages (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get query parameters
    status_filter = request.args.get('status', 'all')
    limit = int(request.args.get('limit', 50))

    if status_filter == 'all':
        messages = contact_messages[-limit:]
    else:
        messages = [msg for msg in contact_messages if msg['status'] == status_filter][-limit:]

    return jsonify({'messages': messages}), 200

@contact_bp.route('/messages/<int:message_id>', methods=['PUT'])
@jwt_required()
def update_message_status(message_id):
    """Update message status (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    new_status = data.get('status')

    if new_status not in ['read', 'replied', 'archived']:
        return jsonify({'error': 'Invalid status'}), 400

    # Find and update the message
    for msg in contact_messages:
        if msg['id'] == message_id:
            msg['status'] = new_status
            return jsonify({'message': 'Status updated successfully'}), 200

    return jsonify({'error': 'Message not found'}), 404

@contact_bp.route('/messages/<int:message_id>', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    """Delete a contact message (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Find and remove the message
    for i, msg in enumerate(contact_messages):
        if msg['id'] == message_id:
            contact_messages.pop(i)
            return jsonify({'message': 'Message deleted successfully'}), 200

    return jsonify({'error': 'Message not found'}), 404

def send_contact_notification_email(message_data):
    """Send email notification to admin about new contact message"""
    try:
        # Email configuration
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_username = os.environ.get('SMTP_USERNAME')
        smtp_password = os.environ.get('SMTP_PASSWORD')

        if not all([smtp_username, smtp_password]):
            return  # Skip if email not configured

        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_username
        msg['To'] = smtp_username  # Send to admin
        msg['Subject'] = f"New Contact Form Message: {message_data['subject']}"

        body = f"""
New contact form submission:

From: {message_data['name']} ({message_data['email']})
Subject: {message_data['subject']}

Message:
{message_data['message']}

---
This is an automated notification from the Laws of Success Academy contact form.
"""

        msg.attach(MIMEText(body, 'plain'))

        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg)
        server.quit()

    except Exception as e:
        print(f"Failed to send contact notification email: {e}")
