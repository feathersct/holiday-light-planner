package com.christmaslightmap.config;

import com.christmaslightmap.security.JwtAuthFilter;
import com.christmaslightmap.security.OAuth2SuccessHandler;
import com.christmaslightmap.security.OAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final OAuth2UserService oauth2UserService;
    private final OAuth2SuccessHandler oauth2SuccessHandler;
    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(withDefaults())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/oauth2/**", "/login/**", "/error").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/displays/mine").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/displays/upvoted").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/displays/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/listings/upvoted").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/listings/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/tags").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/users/search").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/users/*/listings").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/users/handle/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/hosts").permitAll()
                .requestMatchers("/api/v1/hosts", "/api/v1/hosts/**").authenticated()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .userInfoEndpoint(userInfo -> userInfo.userService(oauth2UserService))
                .successHandler(oauth2SuccessHandler)
            )
            .exceptionHandling(ex -> ex
                .defaultAuthenticationEntryPointFor(
                    new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                    request -> request.getRequestURI().startsWith("/api/")
                )
                .defaultAccessDeniedHandlerFor(
                    (request, response, accessDeniedException) ->
                        response.sendError(HttpStatus.FORBIDDEN.value(), "Forbidden"),
                    request -> request.getRequestURI().startsWith("/api/")
                )
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
