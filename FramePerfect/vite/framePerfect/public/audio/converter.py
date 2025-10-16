from moviepy.editor import VideoFileClip

def convert_mp4_to_mp3(input_file, output_file):
    video_clip = VideoFileClip(input_file)
    audio_clip = video_clip.audio
    audio_clip.write_audiofile(output_file)
    audio_clip.close()
    video_clip.close()

# Example usage
input_file = "T8Loop.mp4"
output_file = "T8Loop.mp3"
convert_mp4_to_mp3(input_file, output_file)
