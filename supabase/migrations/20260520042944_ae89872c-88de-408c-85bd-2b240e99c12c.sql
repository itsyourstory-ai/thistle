DELETE FROM book_image_upload_attempts WHERE book_id = '2fadbb08-c509-4416-b81d-77774427fdd6';
DELETE FROM book_images WHERE book_id = '2fadbb08-c509-4416-b81d-77774427fdd6';
UPDATE generated_books
SET pipeline_status = 'idle',
    pipeline_progress = NULL,
    pipeline_error = NULL,
    drive_folder_id = NULL,
    drive_folder_url = NULL,
    drive_export_status = NULL,
    drive_export_error = NULL
WHERE id = '2fadbb08-c509-4416-b81d-77774427fdd6';