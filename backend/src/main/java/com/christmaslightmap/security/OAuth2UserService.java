package com.christmaslightmap.security;

import com.christmaslightmap.model.User;
import com.christmaslightmap.model.UserRole;
import com.christmaslightmap.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class OAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();

        String providerId;
        String email;
        String name;
        String avatarUrl;

        if ("google".equals(registrationId)) {
            providerId = oauth2User.getAttribute("sub");
            email = oauth2User.getAttribute("email");
            name = oauth2User.getAttribute("name");
            avatarUrl = oauth2User.getAttribute("picture");
        } else if ("facebook".equals(registrationId)) {
            providerId = oauth2User.getAttribute("id");
            email = oauth2User.getAttribute("email");
            name = oauth2User.getAttribute("name");
            Map<String, Object> picture = oauth2User.getAttribute("picture");
            @SuppressWarnings("unchecked")
            Map<String, Object> pictureData = picture != null ? (Map<String, Object>) picture.get("data") : null;
            avatarUrl = pictureData != null ? (String) pictureData.get("url") : null;
        } else {
            throw new OAuth2AuthenticationException("Unsupported provider: " + registrationId);
        }

        String finalEmail = email;
        String finalName = name;
        String finalAvatarUrl = avatarUrl;

        User user = userRepository.findByProviderAndProviderId(registrationId, providerId)
            .map(existing -> {
                existing.setEmail(finalEmail);
                existing.setName(finalName);
                existing.setAvatarUrl(finalAvatarUrl);
                return userRepository.save(existing);
            })
            .orElseGet(() -> userRepository.save(User.builder()
                .provider(registrationId)
                .providerId(providerId)
                .email(finalEmail)
                .name(finalName)
                .avatarUrl(finalAvatarUrl)
                .role(UserRole.USER)
                .build()));

        return new CustomOAuth2User(oauth2User, user);
    }
}
