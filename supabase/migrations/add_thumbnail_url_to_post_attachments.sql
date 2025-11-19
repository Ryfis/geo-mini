/*
  # Add thumbnail_url column to post_attachments table
  
  This migration adds support for thumbnail images in post attachments.
  
  Changes:
    - Add `thumbnail_url` column to store thumbnail image URLs
    - Allow NULL values for backward compatibility
*/

ALTER TABLE post_attachments 
ADD COLUMN thumbnail_url text;