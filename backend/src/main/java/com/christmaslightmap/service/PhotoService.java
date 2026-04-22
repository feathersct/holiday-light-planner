package com.christmaslightmap.service;

import com.christmaslightmap.dto.response.PhotoResponse;
import com.christmaslightmap.model.DisplayPhoto;
import com.christmaslightmap.repository.DisplayPhotoRepository;
import com.christmaslightmap.repository.DisplayRepository;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PhotoService {

    private final S3Client s3Client;
    private final DisplayRepository displayRepository;
    private final DisplayPhotoRepository displayPhotoRepository;
    private final UserRepository userRepository;

    @Value("${app.r2.bucket}")
    private String bucket;

    @Value("${app.r2.endpoint}")
    private String endpoint;

    @Transactional
    public PhotoResponse uploadPhoto(Long displayId, Long userId, MultipartFile file) {
        var display = displayRepository.findById(displayId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Display not found"));
        var user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        String extension = getExtension(file.getOriginalFilename());
        String key = "displays/" + displayId + "/" + UUID.randomUUID() + extension;

        try {
            s3Client.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build(),
                RequestBody.fromBytes(file.getBytes())
            );
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "File upload failed");
        }

        String url = endpoint + "/" + bucket + "/" + key;
        boolean isPrimary = display.getPhotoCount() == 0;

        DisplayPhoto photo = displayPhotoRepository.save(DisplayPhoto.builder()
            .display(display)
            .user(user)
            .url(url)
            .isPrimary(isPrimary)
            .build());

        return PhotoResponse.from(photo);
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf("."));
    }
}
