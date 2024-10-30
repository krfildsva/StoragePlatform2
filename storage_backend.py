import sys
import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
from Crypto.Random import get_random_bytes

def encrypt_and_fragment(file_path, output_dir, chunk_size=1024):
    os.makedirs(output_dir, exist_ok=True)  # Ensure output directory exists
    
    key = get_random_bytes(32)  # AES-256 key
    cipher = AES.new(key, AES.MODE_CBC)
    iv = cipher.iv

    with open(file_path, 'rb') as f:
        data = f.read()

    encrypted_data = cipher.encrypt(pad(data, AES.block_size))

    # Save encryption metadata (iv and key)
    with open(f"{output_dir}/metadata.txt", "wb") as f:
        f.write(iv + key)

    # Fragment encrypted data
    fragments = [encrypted_data[i:i+chunk_size] for i in range(0, len(encrypted_data), chunk_size)]
    for idx, fragment in enumerate(fragments):
        with open(f"{output_dir}/fragment_{idx}.bin", "wb") as f:
            f.write(fragment)

    print("Encryption and fragmentation successful.")

if __name__ == "__main__":
    # Get file path and output directory from command-line arguments
    file_path = sys.argv[1]
    output_dir = sys.argv[2]
    encrypt_and_fragment(file_path, output_dir)

