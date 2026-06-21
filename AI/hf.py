from huggingface_hub import upload_folder

upload_folder(
    folder_path="best_garment_model",
    repo_id="mohdabdulrahman510/best_garment_model",
    repo_type="model"
)
