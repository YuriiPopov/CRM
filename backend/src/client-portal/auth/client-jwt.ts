// Токены клиентского приложения подписываются тем же JWT_SECRET, что и токены сотрудников, но
// несут свой audience: ClientJwtStrategy принимает только его, а JwtStrategy сотрудников ищет
// sub в таблице users — поэтому токены двух типов не взаимозаменяемы.
export const CLIENT_JWT_AUDIENCE = 'b4u-client-app';

export interface ClientJwtPayload {
  sub: string; // Client.id
  salonId: string;
}

export interface AuthenticatedClient {
  clientId: string;
  salonId: string;
}
