# Profile Completion Endpoints - To be added to auth.py

@auth_bp.route('/profile/check-completion', methods=['GET'])
@jwt_required()
def check_profile_completion():
    """Check if user profile is complete and return missing fields"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get parent and student records
        parent = Parent.query.filter_by(user_id=user_id).first()
        student = Student.query.filter_by(user_id=user_id).first()
        
        missing_fields = []
        
        # Check user fields
        if not user.full_name:
            missing_fields.append('user_full_name')
        if not user.email:
            missing_fields.append('user_email')
        if not user.phone:
            missing_fields.append('user_phone')
        if not user.gender:
            missing_fields.append('user_gender')
        
        # Check parent fields
        if parent:
            if not parent.full_name:
                missing_fields.append('parent_full_name')
            if not parent.phone:
                missing_fields.append('parent_phone')
            if not parent.email:
                missing_fields.append('parent_email')
        else:
            missing_fields.extend(['parent_full_name', 'parent_phone', 'parent_email'])
        
        # Check student fields
        if student:
            if not student.name:
                missing_fields.append('student_name')
            if not student.date_of_birth:
                missing_fields.append('student_date_of_birth')
        else:
            missing_fields.extend(['student_name', 'student_date_of_birth'])
        
        profile_complete = len(missing_fields) == 0
        
        return jsonify({
            'profile_complete': profile_complete,
            'missing_fields': missing_fields,
            'user': {
                'id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'gender': user.gender
            },
            'parent': {
                'id': parent.id if parent else None,
                'full_name': parent.full_name if parent else None,
                'phone': parent.phone if parent else None,
                'email': parent.email if parent else None
            } if parent else None,
            'student': {
                'id': student.id if student else None,
                'name': student.name if student else None,
                'date_of_birth': student.date_of_birth.isoformat() if student and student.date_of_birth else None
            } if student else None
        }), 200
        
    except Exception as e:
        print(f"❌ [PROFILE_CHECK] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to check profile completion: {str(e)}'}), 500


@auth_bp.route('/profile/complete', methods=['POST'])
@jwt_required()
def complete_profile():
    """Update user, parent, and student information to complete profile"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update user information
        if 'user_full_name' in data and data['user_full_name']:
            user.full_name = data['user_full_name'].strip()
        if 'user_email' in data and data['user_email']:
            # Check if email already exists for another user
            existing_user = User.query.filter_by(email=data['user_email']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email already in use by another account'}), 400
            user.email = data['user_email'].strip()
            user.email_verified = True
        if 'user_phone' in data and data['user_phone']:
            # Validate phone format
            from auth import validate_phone
            if not validate_phone(data['user_phone']):
                return jsonify({'error': 'Invalid phone number format'}), 400
            user.phone = data['user_phone'].strip()
        if 'user_gender' in data and data['user_gender'] in ['male', 'female']:
            user.gender = data['user_gender']
        
        # Update parent information
        parent = Parent.query.filter_by(user_id=user_id).first()
        if parent:
            if 'parent_full_name' in data and data['parent_full_name']:
                parent.full_name = data['parent_full_name'].strip()
            if 'parent_phone' in data and data['parent_phone']:
                from auth import validate_phone
                if not validate_phone(data['parent_phone']):
                    return jsonify({'error': 'Invalid parent phone number format'}), 400
                parent.phone = data['parent_phone'].strip()
            if 'parent_email' in data and data['parent_email']:
                parent.email = data['parent_email'].strip()
        
        # Update student information
        student = Student.query.filter_by(user_id=user_id).first()
        if student:
            if 'student_name' in data and data['student_name']:
                student.name = data['student_name'].strip()
            if 'student_date_of_birth' in data and data['student_date_of_birth']:
                from datetime import datetime
                try:
                    # Parse date (format: YYYY-MM-DD)
                    student.date_of_birth = datetime.strptime(data['student_date_of_birth'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        db.session.commit()
        print(f"✅ [PROFILE_COMPLETE] User {user_id} profile updated successfully")
        
        # Check if profile is now complete
        missing_fields = []
        if not user.full_name:
            missing_fields.append('user_full_name')
        if not user.email:
            missing_fields.append('user_email')
        if not user.phone:
            missing_fields.append('user_phone')
        if not user.gender:
            missing_fields.append('user_gender')
        if parent:
            if not parent.full_name:
                missing_fields.append('parent_full_name')
            if not parent.phone:
                missing_fields.append('parent_phone')
            if not parent.email:
                missing_fields.append('parent_email')
        if student:
            if not student.name:
                missing_fields.append('student_name')
            if not student.date_of_birth:
                missing_fields.append('student_date_of_birth')
        
        return jsonify({
            'success': True,
            'profile_complete': len(missing_fields) == 0,
            'missing_fields': missing_fields,
            'user': {
                'id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'gender': user.gender,
                'email_verified': user.email_verified
            },
            'parent': {
                'id': parent.id if parent else None,
                'full_name': parent.full_name if parent else None,
                'phone': parent.phone if parent else None,
                'email': parent.email if parent else None
            } if parent else None,
            'student': {
                'id': student.id if student else None,
                'name': student.name if student else None,
                'date_of_birth': student.date_of_birth.isoformat() if student and student.date_of_birth else None
            } if student else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ [PROFILE_COMPLETE] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to complete profile: {str(e)}'}), 500
