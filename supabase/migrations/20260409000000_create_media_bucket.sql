-- Ensure the media bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];

-- Add policy to allow public access to objects in the media bucket if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Public Access to Media'
    ) THEN
        CREATE POLICY "Public Access to Media"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'media' );
    END IF;
END
$$;

-- Allow authenticated users to upload media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Authenticated Users can upload media'
    ) THEN
        CREATE POLICY "Authenticated Users can upload media"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK ( bucket_id = 'media' );
    END IF;
END
$$;
