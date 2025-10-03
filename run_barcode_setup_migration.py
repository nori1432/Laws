"""
Migration script to add barcode setup columns to users table
Run this script to apply the barcode setup migration
"""

from app import app, db
from models import User

def run_migration():
    """Add barcode setup columns to users table"""
    with app.app_context():
        try:
            print("🔄 Starting barcode setup migration...")
            
            # Add barcode_setup_token column
            try:
                db.session.execute(db.text("""
                    ALTER TABLE users 
                    ADD COLUMN barcode_setup_token VARCHAR(255) NULL
                """))
                db.session.commit()
                print("✅ Added barcode_setup_token column")
            except Exception as e:
                db.session.rollback()
                if "Duplicate column name" in str(e) or "already exists" in str(e):
                    print("⚠️  barcode_setup_token column already exists")
                else:
                    raise
            
            # Add barcode_setup_completed column
            try:
                db.session.execute(db.text("""
                    ALTER TABLE users 
                    ADD COLUMN barcode_setup_completed BOOLEAN DEFAULT FALSE
                """))
                db.session.commit()
                print("✅ Added barcode_setup_completed column")
            except Exception as e:
                db.session.rollback()
                if "Duplicate column name" in str(e) or "already exists" in str(e):
                    print("⚠️  barcode_setup_completed column already exists")
                else:
                    raise
            
            # Create index for performance
            try:
                db.session.execute(db.text("""
                    CREATE INDEX idx_users_barcode_setup_token 
                    ON users(barcode_setup_token)
                """))
                db.session.commit()
                print("✅ Created index on barcode_setup_token")
            except Exception as e:
                db.session.rollback()
                if "Duplicate key name" in str(e) or "already exists" in str(e):
                    print("⚠️  Index already exists")
                else:
                    raise
            
            # Update existing users to mark as completed
            result = db.session.execute(db.text("""
                UPDATE users 
                SET barcode_setup_completed = TRUE 
                WHERE barcode_setup_token IS NULL
            """))
            db.session.commit()
            print(f"✅ Updated {result.rowcount} existing users to mark setup as completed")
            
            print("\n🎉 Migration completed successfully!")
            print("\nNew columns added to users table:")
            print("  - barcode_setup_token VARCHAR(255) NULL")
            print("  - barcode_setup_completed BOOLEAN DEFAULT FALSE")
            print("\nYou can now use the barcode setup login flow!")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    return True

if __name__ == '__main__':
    run_migration()
